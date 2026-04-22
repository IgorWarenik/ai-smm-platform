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
  await prisma.$executeRawUnsafe('ALTER TABLE knowledge_items ADD COLUMN IF NOT EXISTS embedding vector(1024)')
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

echo "Starting API..."
exec node apps/api/dist/apps/api/src/index.js
