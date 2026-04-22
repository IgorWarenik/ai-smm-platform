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

    const queryVector = await embedText(query.q)
    const ragBudget = resolveRagBudget(query)
    const vectorParam = `[${queryVector.join(',')}]`

    // Use separate queries for category-filtered vs full search to avoid
    // string interpolation SQL injection. category is validated by Zod enum
    // but parameterized queries are safer regardless.
    const results = await withProjectContext(projectId, userId, async (tx) => {
      return query.category
        ? tx.$queryRawUnsafe<Array<{
            id: string
            category: string
            content: string
            metadata: object
            similarity: number
          }>>(
            `SELECT id, category, content, metadata,
                    1 - (embedding <=> $1::vector) AS similarity
             FROM knowledge_items
             WHERE project_id = $2::uuid
               AND category = $5
               AND embedding IS NOT NULL
               AND 1 - (embedding <=> $1::vector) >= $4
             ORDER BY embedding <=> $1::vector
             LIMIT $3`,
            vectorParam,
            projectId,
            query.limit,
            ragBudget.minSimilarity,
            query.category
          )
        : tx.$queryRawUnsafe<Array<{
            id: string
            category: string
            content: string
            metadata: object
            similarity: number
          }>>(
            `SELECT id, category, content, metadata,
                    1 - (embedding <=> $1::vector) AS similarity
             FROM knowledge_items
             WHERE project_id = $2::uuid
               AND embedding IS NOT NULL
               AND 1 - (embedding <=> $1::vector) >= $4
             ORDER BY embedding <=> $1::vector
             LIMIT $3`,
            vectorParam,
            projectId,
            query.limit,
            ragBudget.minSimilarity
          )
    })

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
      const items = await tx.knowledgeItem.findMany({
        where: { projectId },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      })
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
}
