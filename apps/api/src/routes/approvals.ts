import type { FastifyInstance } from 'fastify'
import { prisma, withProjectContext } from '@ai-marketing/db'
import { CreateApprovalSchema, PaginationSchema } from '@ai-marketing/shared'
import { TaskStatus, ApprovalDecision, APPROVAL_MAX_REVISIONS } from '@ai-marketing/shared'

export async function approvalRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /api/projects/:projectId/tasks/:taskId/approvals
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

      const [approvals, total] = await tx.$transaction([
        tx.approval.findMany({
          where: { taskId, projectId },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        tx.approval.count({ where: { taskId, projectId } }),
      ])

      return reply.send({ data: approvals, total, page: query.page, pageSize: query.pageSize })
    })
  })

  // POST /api/projects/:projectId/tasks/:taskId/approvals
  // Client approves, rejects, or requests revision (§11.4 ТЗ)
  app.post('/', async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string }
    const userId = request.user.sub
    const body = CreateApprovalSchema.parse(request.body)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    return withProjectContext(projectId, userId, async (tx) => {
      const task = await tx.task.findFirst({ where: { id: taskId, projectId } })
      if (!task) return reply.notFound('Task not found')

      if (task.status !== TaskStatus.AWAITING_APPROVAL) {
        return reply.badRequest('Task is not awaiting approval')
      }

      // Count existing revision requests for this task
      const revisionCount = await tx.approval.count({
        where: { taskId, projectId, decision: ApprovalDecision.REVISION_REQUESTED },
      })

      const iteration = revisionCount + 1

      // After APPROVAL_MAX_REVISIONS revisions, decision is escalated to manager
      // We still record the approval but flag when limit is reached
      const approval = await tx.approval.create({
        data: {
          projectId,
          taskId,
          decision: body.decision,
          comment: body.comment,
          iteration,
          decidedById: userId,
        },
      })

      // Update task status based on decision
      let nextStatus: TaskStatus
      if (body.decision === ApprovalDecision.APPROVED) {
        nextStatus = TaskStatus.COMPLETED
      } else if (body.decision === ApprovalDecision.REJECTED) {
        nextStatus = TaskStatus.REJECTED
      } else {
        // REVISION_REQUESTED — check if max iterations reached
        if (revisionCount >= APPROVAL_MAX_REVISIONS) {
          // Cap exceeded: flag for human review, stay in AWAITING_APPROVAL
          nextStatus = TaskStatus.AWAITING_APPROVAL
        } else {
          nextStatus = TaskStatus.QUEUED
        }
      }

      await tx.task.update({
        where: { id: taskId },
        data: {
          status: nextStatus,
          ...(body.decision === ApprovalDecision.REJECTED && { rejectedAt: new Date() }),
          ...(body.decision === ApprovalDecision.REVISION_REQUESTED &&
            revisionCount >= APPROVAL_MAX_REVISIONS && { requiresReview: true }),
        },
      })

      return reply.code(201).send({
        data: approval,
        meta: {
          revisionCount: iteration,
          maxRevisions: APPROVAL_MAX_REVISIONS,
          managerEscalated: body.decision === ApprovalDecision.REVISION_REQUESTED && revisionCount >= APPROVAL_MAX_REVISIONS,
        },
      })
    })
  })
}
