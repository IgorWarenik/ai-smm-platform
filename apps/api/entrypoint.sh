#!/bin/sh
set -e

echo "Syncing DB schema..."
./packages/db/node_modules/.bin/prisma db push \
  --schema packages/db/prisma/schema.prisma \
  --accept-data-loss \
  --skip-generate 2>&1 || echo "Warning: schema sync failed, continuing"

echo "Ensuring pgvector knowledge schema..."
node <<'NODE' || echo "Warning: pgvector knowledge schema sync failed, continuing"
const { PrismaClient } = require('/repo/packages/db/node_modules/@prisma/client')

const prisma = new PrismaClient()

async function main() {
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector')
  await prisma.$executeRawUnsafe('ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS embedding vector(512)')
  // Migrate existing 1024-dim column to 512 if needed
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_attribute a JOIN pg_class c ON a.attrelid = c.oid
        WHERE c.relname = 'knowledge_items' AND a.attname = 'embedding'
          AND pg_catalog.format_type(a.atttypid, a.atttypmod) = 'vector(1024)'
      ) THEN
        ALTER TABLE knowledge_items ALTER COLUMN embedding TYPE vector(512) USING NULL;
      END IF;
    END $$
  `)
  await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS knowledge_items_embedding_idx')
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS knowledge_items_embedding_idx ON knowledge_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)'
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
NODE

echo "Starting re-embed job in background..."
node <<'REEMBED' &
const { PrismaClient } = require('/repo/packages/db/node_modules/@prisma/client')
const { VoyageAIClient } = require('/repo/packages/ai-engine/node_modules/voyageai')

const prisma = new PrismaClient()
const voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY ?? '' })

async function reembed() {
  const items = await prisma.$queryRawUnsafe(
    `SELECT id, content, project_id FROM knowledge_items WHERE embedding IS NULL LIMIT 200`
  )
  if (!items.length) { console.log('Re-embed: nothing to do'); return }
  console.log(`Re-embed: ${items.length} items to process`)
  for (const item of items) {
    try {
      const res = await voyage.embed({ input: item.content, model: 'voyage-3-lite' })
      const vec = res.data?.[0]?.embedding
      if (!vec) continue
      await prisma.$executeRawUnsafe(
        `UPDATE knowledge_items SET embedding = $1::vector WHERE id = $2::uuid`,
        `[${vec.join(',')}]`, item.id
      )
      console.log(`Re-embed: ok ${item.id}`)
      await new Promise(r => setTimeout(r, 21000))
    } catch (err) {
      console.warn(`Re-embed: failed ${item.id}`, err?.message ?? err)
      await new Promise(r => setTimeout(r, 60000))
    }
  }
}

reembed()
  .catch(err => console.error('Re-embed job failed:', err))
  .finally(() => prisma.$disconnect())
REEMBED

echo "Starting API..."
exec node apps/api/dist/apps/api/src/index.js
