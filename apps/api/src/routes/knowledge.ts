import type { FastifyInstance } from 'fastify'
import { prisma, withProjectContext } from '@ai-marketing/db'
import {
  CreateKnowledgeItemSchema,
  KnowledgeSearchSchema,
} from '@ai-marketing/shared'
import { applyRagBudget, buildRagPack, embedText, resolveRagBudget } from '@ai-marketing/ai-engine'

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
          projectId,
          category: body.category,
          content: body.content,
          metadata: body.metadata ?? {},
        },
      })
    })

    // Embed and store vector (non-blocking, best-effort)
    embedText(body.content)
      .then(async (vector) => {
        await prisma.$executeRawUnsafe(
          `UPDATE knowledge_items SET embedding = $1::vector WHERE id = $2`,
          `[${vector.join(',')}]`,
          item.id
        )
      })
      .catch((err) => app.log.warn({ err }, 'Embedding failed — item stored without vector'))

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
    const results = await (query.category
      ? prisma.$queryRawUnsafe<Array<{
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
      : prisma.$queryRawUnsafe<Array<{
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
        ))

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

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    return withProjectContext(projectId, userId, async (tx) => {
      const items = await tx.knowledgeItem.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send({ data: items })
    })
  })
}
