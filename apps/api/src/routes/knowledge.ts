import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { prisma, type Prisma, withProjectContext } from '@ai-marketing/db'
import {
  CreateKnowledgeItemSchema,
  KnowledgeCategory,
  KnowledgeSearchSchema,
  PaginationSchema,
} from '@ai-marketing/shared'
import { applyRagBudget, buildRagPack, embedText, resolveRagBudget } from '@ai-marketing/ai-engine'
import { z } from 'zod'
import multipart from '@fastify/multipart'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse')
import mammoth from 'mammoth'

const PatchKnowledgeItemSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  metadata: z.record(z.unknown()).optional(),
  category: z.nativeEnum(KnowledgeCategory).optional(),
})

export async function knowledgeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // POST /api/projects/:projectId/knowledge
  app.post('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const userId = request.user.sub
    const body = CreateKnowledgeItemSchema.parse(request.body)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    // Create record first
    const item = await withProjectContext(projectId, userId, async (tx) => {
      return tx.knowledgeItem.create({
        data: {
          id: randomUUID(),
          projectId,
          category: body.category,
          content: body.content,
          metadata: body.metadata ?? {},
        },
      })
    })

    // Embed and store vector (non-blocking, best-effort)
    const serviceUserId =
      process.env.INTERNAL_SERVICE_USER_ID ?? '00000000-0000-0000-0000-000000000000'
    embedText(body.content)
      .then(async (vector) => {
        await withProjectContext(projectId, serviceUserId, async (tx) => {
          await tx.$executeRawUnsafe(
            `UPDATE knowledge_items SET embedding = $1::vector WHERE id = $2::uuid AND project_id = $3::uuid`,
            `[${vector.join(',')}]`,
            item.id,
            projectId
          )
        })
      })
      .catch((err) => app.log.warn({ err, itemId: item.id }, 'Embedding failed — item stored without vector'))

    return reply.code(201).send({ data: item })
  })

  // GET /api/projects/:projectId/knowledge/search
  app.get('/search', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const userId = request.user.sub
    const query = KnowledgeSearchSchema.parse(request.query)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    const ragBudget = resolveRagBudget(query)

    // Check if any embeddings exist for this project
    const [{ count: embeddedCount }] = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) AS count FROM knowledge_items WHERE project_id = $1::uuid AND embedding IS NOT NULL`,
      projectId
    )

    if (Number(embeddedCount) === 0) {
      return reply.send({ data: [], shortlist: [], promptPack: '', notReady: true })
    }

    const queryVector = await embedText(query.q)
    const vectorParam = `[${queryVector.join(',')}]`

    let results = await withProjectContext(projectId, userId, async (tx) => {
      return query.category
        ? tx.$queryRawUnsafe<Array<{ id: string; category: string; content: string; metadata: object; similarity: number }>>(
            `SELECT id, category, content, metadata,
                    1 - (embedding <=> $1::vector) AS similarity
             FROM knowledge_items
             WHERE project_id = $2::uuid
               AND category = $5
               AND embedding IS NOT NULL
               AND 1 - (embedding <=> $1::vector) >= $4
             ORDER BY embedding <=> $1::vector
             LIMIT $3`,
            vectorParam, projectId, query.limit, ragBudget.minSimilarity, query.category
          )
        : tx.$queryRawUnsafe<Array<{ id: string; category: string; content: string; metadata: object; similarity: number }>>(
            `SELECT id, category, content, metadata,
                    1 - (embedding <=> $1::vector) AS similarity
             FROM knowledge_items
             WHERE project_id = $2::uuid
               AND embedding IS NOT NULL
               AND 1 - (embedding <=> $1::vector) >= $4
             ORDER BY embedding <=> $1::vector
             LIMIT $3`,
            vectorParam, projectId, query.limit, ragBudget.minSimilarity
          )
    })

    if (results.length === 0) {
      results = await withProjectContext(projectId, userId, async (tx) => {
        return query.category
          ? tx.$queryRawUnsafe<Array<{ id: string; category: string; content: string; metadata: object; similarity: number }>>(
              `SELECT id, category, content, metadata,
                      1.0::double precision AS similarity
               FROM knowledge_items
               WHERE project_id = $1::uuid
                 AND category = $4
                 AND content ILIKE '%' || $2 || '%'
               ORDER BY created_at DESC
               LIMIT $3`,
              projectId, query.q, query.limit, query.category
            )
          : tx.$queryRawUnsafe<Array<{ id: string; category: string; content: string; metadata: object; similarity: number }>>(
              `SELECT id, category, content, metadata,
                      1.0::double precision AS similarity
               FROM knowledge_items
               WHERE project_id = $1::uuid
                 AND content ILIKE '%' || $2 || '%'
               ORDER BY created_at DESC
               LIMIT $3`,
              projectId, query.q, query.limit
            )
      })
    }

    const data = applyRagBudget(results, ragBudget)
    const ragPack = buildRagPack(data)

    return reply.send({
      data,
      shortlist: ragPack.shortlist,
      promptPack: ragPack.promptPack,
    })
  })

  // GET /api/projects/:projectId/knowledge
  app.get('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const userId = request.user.sub
    const query = PaginationSchema.parse(request.query)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    return withProjectContext(projectId, userId, async (tx) => {
      const offset = (query.page - 1) * query.pageSize
      const items = await tx.$queryRawUnsafe<Array<{
        id: string; projectId: string; category: string; content: string
        metadata: object; createdAt: Date; hasEmbedding: boolean
      }>>(
        `SELECT id, project_id AS "projectId", category, content, metadata,
                created_at AS "createdAt",
                (embedding IS NOT NULL) AS "hasEmbedding"
         FROM knowledge_items
         WHERE project_id = $1::uuid
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        projectId, query.pageSize, offset
      )
      const total = await tx.knowledgeItem.count({ where: { projectId } })

      return reply.send({ data: items, total, page: query.page, pageSize: query.pageSize })
    })
  })

  // DELETE /api/projects/:projectId/knowledge/:itemId
  app.delete('/:itemId', async (request, reply) => {
    const { projectId, itemId } = request.params as { projectId: string; itemId: string }
    const userId = request.user.sub

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    return withProjectContext(projectId, userId, async (tx) => {
      const item = await tx.knowledgeItem.findUnique({ where: { id: itemId } })
      if (!item || item.projectId !== projectId) return reply.notFound('Knowledge item not found')

      await tx.knowledgeItem.delete({ where: { id: itemId } })
      return reply.code(204).send()
    })
  })

  // PATCH /api/projects/:projectId/knowledge/:itemId
  app.patch('/:itemId', async (request, reply) => {
    const { projectId, itemId } = request.params as { projectId: string; itemId: string }
    const userId = request.user.sub
    const body = PatchKnowledgeItemSchema.parse(request.body)

    if (Object.keys(body).length === 0) {
      return reply.badRequest('At least one field required')
    }

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    return withProjectContext(projectId, userId, async (tx) => {
      const item = await tx.knowledgeItem.findUnique({ where: { id: itemId } })
      if (!item || item.projectId !== projectId) return reply.notFound('Knowledge item not found')

      const updated = await tx.knowledgeItem.update({
        where: { id: itemId },
        data: {
          ...(body.content !== undefined && { content: body.content }),
          ...(body.metadata !== undefined && { metadata: body.metadata as Prisma.InputJsonValue }),
          ...(body.category !== undefined && { category: body.category }),
        },
      })

      if (body.content !== undefined) {
        const serviceUserId =
          process.env.INTERNAL_SERVICE_USER_ID ?? '00000000-0000-0000-0000-000000000000'
        embedText(body.content)
          .then(async (vector) => {
            await withProjectContext(projectId, serviceUserId, async (ctx) => {
              await ctx.$executeRawUnsafe(
                `UPDATE knowledge_items SET embedding = $1::vector WHERE id = $2::uuid AND project_id = $3::uuid`,
                `[${vector.join(',')}]`,
                itemId,
                projectId
              )
            })
          })
          .catch((err) => {
            console.error({ err, itemId }, 'Failed to re-embed updated knowledge item')
          })
      }

      return reply.send({ data: updated })
    })
  })

  // POST /api/projects/:projectId/knowledge/upload
  app.register(async (uploadApp) => {
    uploadApp.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } }) // 20 MB

    uploadApp.post('/upload', async (request, reply) => {
      const { projectId } = request.params as { projectId: string }
      const userId = request.user.sub

      const membership = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId } },
      })
      if (!membership) return reply.notFound('Project not found')

      const parts = request.parts()
      let fileBuffer: Buffer | null = null
      let fileName = ''
      let mimeType = ''
      let category: string = 'BRAND_GUIDE'
      let description = ''

      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks: Buffer[] = []
          for await (const chunk of part.file) {
            chunks.push(chunk as Buffer)
          }
          fileBuffer = Buffer.concat(chunks)
          fileName = part.filename ?? 'file'
          mimeType = part.mimetype ?? ''
        } else {
          if (part.fieldname === 'category') {
            category = (part as any).value ?? category
          } else if (part.fieldname === 'description') {
            description = String((part as any).value ?? '').trim().slice(0, 1000)
          }
        }
      }

      if (!fileBuffer) return reply.badRequest('No file provided')

      // Parse text from file
      let text = ''
      const ext = fileName.split('.').pop()?.toLowerCase() ?? ''

      try {
        if (ext === 'pdf' || mimeType === 'application/pdf') {
          const result = await pdfParse(fileBuffer)
          text = result.text
        } else if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const result = await mammoth.extractRawText({ buffer: fileBuffer })
          text = result.value
        } else if (ext === 'doc' || mimeType === 'application/msword') {
          const result = await mammoth.extractRawText({ buffer: fileBuffer })
          text = result.value
        } else if (ext === 'md' || ext === 'txt' || mimeType.startsWith('text/')) {
          text = fileBuffer.toString('utf-8')
        } else {
          return reply.badRequest('Unsupported file type. Supported: PDF, DOCX, DOC, MD, TXT')
        }
      } catch (parseErr: any) {
        return reply.badRequest(`Failed to parse file: ${parseErr?.message ?? 'unknown error'}`)
      }

      text = text.trim()
      if (!text) return reply.badRequest('File appears to be empty or could not be parsed')

      // Chunk large text (max 4000 chars per item to stay within embedding limits)
      const CHUNK_SIZE = 4000
      const CHUNK_OVERLAP = 200
      const chunks: string[] = []

      if (text.length <= CHUNK_SIZE) {
        chunks.push(text)
      } else {
        let start = 0
        while (start < text.length) {
          const end = Math.min(start + CHUNK_SIZE, text.length)
          chunks.push(text.slice(start, end))
          start = end - CHUNK_OVERLAP
          if (start >= text.length - CHUNK_OVERLAP) break
        }
      }

      const serviceUserId = process.env.INTERNAL_SERVICE_USER_ID ?? '00000000-0000-0000-0000-000000000000'
      const items: any[] = []

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const title = chunks.length > 1 ? `${fileName} (часть ${i + 1}/${chunks.length})` : fileName

        const item = await withProjectContext(projectId, userId, async (tx) => {
          return tx.knowledgeItem.create({
            data: {
              id: randomUUID(),
              projectId,
              category: (category as any) in KnowledgeCategory ? (category as any) : 'BRAND_GUIDE',
              content: chunk,
              metadata: { title, sourceFile: fileName, ...(description && { description }) },
            },
          })
        })

        items.push(item)

        // Embed non-blocking
        embedText(chunk)
          .then(async (vector) => {
            await withProjectContext(projectId, serviceUserId, async (tx) => {
              await tx.$executeRawUnsafe(
                `UPDATE knowledge_items SET embedding = $1::vector WHERE id = $2::uuid AND project_id = $3::uuid`,
                `[${vector.join(',')}]`,
                item.id,
                projectId
              )
            })
          })
          .catch((err) => app.log.warn({ err, itemId: item.id }, 'Upload embedding failed'))
      }

      return reply.code(201).send({ data: items, chunks: chunks.length })
    })
  })
}
