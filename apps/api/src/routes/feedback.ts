import type { FastifyInstance } from 'fastify'
import { prisma, withProjectContext } from '@ai-marketing/db'
import { CreateAgentFeedbackSchema, PaginationSchema } from '@ai-marketing/shared'

export async function feedbackRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /api/projects/:projectId/tasks/:taskId/feedback
  app.get('/', async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string }
    const userId = request.user.sub
    const query = PaginationSchema.parse(request.query)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    return withProjectContext(projectId, userId, async (tx) => {
      const task = await tx.task.findFirst({ where: { id: taskId, projectId } })
      if (!task) return reply.notFound('Task not found')

      const [items, total] = await tx.$transaction([
        tx.agentFeedback.findMany({
          where: { taskId, projectId },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        tx.agentFeedback.count({ where: { taskId, projectId } }),
      ])

      return reply.send({ data: items, total, page: query.page, pageSize: query.pageSize })
    })
  })

  // POST /api/projects/:projectId/tasks/:taskId/feedback
  // Submit feedback for an agent's output (§9.1 ТЗ)
  app.post('/', async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string }
    const userId = request.user.sub
    const body = CreateAgentFeedbackSchema.parse(request.body)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    return withProjectContext(projectId, userId, async (tx) => {
      const task = await tx.task.findFirst({ where: { id: taskId, projectId } })
      if (!task) return reply.notFound('Task not found')

      const feedback = await tx.agentFeedback.create({
        data: {
          projectId,
          taskId,
          agentType: body.agentType,
          score: body.score,
          comment: body.comment,
        },
      })

      return reply.code(201).send({ data: feedback })
    })
  })
}
