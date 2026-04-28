import type { FastifyInstance, FastifyReply } from 'fastify'
import { randomUUID } from 'crypto'
import { prisma, withProjectContext } from '@ai-marketing/db'
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  AddProjectMemberSchema,
  PaginationSchema,
} from '@ai-marketing/shared'
import { MemberRole } from '@ai-marketing/shared'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertUuid(reply: FastifyReply, value: string, label: string): boolean {
  if (!UUID_RE.test(value)) {
    reply.badRequest(`${label} must be a valid UUID`)
    return false
  }
  return true
}

export async function projectRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', app.authenticate)

  // POST /api/projects
  app.post('/', async (request, reply) => {
    const userId = request.user.sub
    const body = CreateProjectSchema.parse(request.body)

    const project = await prisma.project.create({
      data: {
        id: randomUUID(),
        ownerId: userId,
        name: body.name,
        settings: body.settings ?? {},
        members: {
          create: { id: randomUUID(), userId, role: MemberRole.OWNER },
        },
      },
    })

    return reply.code(201).send({ data: project })
  })

  // GET /api/projects
  app.get('/', async (request, reply) => {
    const userId = request.user.sub
    const query = PaginationSchema.parse(request.query)

    const [projects, total] = await prisma.$transaction([
      prisma.project.findMany({
        where: {
          members: { some: { userId } },
        },
        include: {
          _count: { select: { tasks: true } },
        },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.count({
        where: { members: { some: { userId } } },
      }),
    ])

    return reply.send({
      data: projects,
      total,
      page: query.page,
      pageSize: query.pageSize,
    })
  })

  // GET /api/projects/:projectId
  app.get('/:projectId', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    if (!assertUuid(reply, projectId, 'projectId')) return
    const userId = request.user.sub

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    return withProjectContext(projectId, userId, async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: projectId },
        include: { _count: { select: { tasks: true } } },
      })
      if (!project) return reply.notFound('Project not found')
      return reply.send({ data: project })
    })
  })

  // PATCH /api/projects/:projectId
  app.patch('/:projectId', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    if (!assertUuid(reply, projectId, 'projectId')) return
    const userId = request.user.sub
    const body = UpdateProjectSchema.parse(request.body)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')
    if (membership.role === MemberRole.VIEWER) {
      return reply.forbidden('Insufficient permissions')
    }

    return withProjectContext(projectId, userId, async (tx) => {
      const project = await tx.project.update({
        where: { id: projectId },
        data: {
          ...(body.name && { name: body.name }),
          ...(body.settings && { settings: body.settings }),
        },
      })
      return reply.send({ data: project })
    })
  })

  // DELETE /api/projects/:projectId
  app.delete('/:projectId', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    if (!assertUuid(reply, projectId, 'projectId')) return
    const userId = request.user.sub

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')
    if (membership.role !== MemberRole.OWNER) {
      return reply.forbidden('Only project owner can delete')
    }

    await prisma.$transaction(async (tx) => {
      const tasks = await tx.task.findMany({
        where: { projectId },
        select: { id: true },
      })
      const taskIds = tasks.map((task) => task.id)

      if (taskIds.length > 0) {
        const executions = await tx.execution.findMany({
          where: { taskId: { in: taskIds } },
          select: { id: true },
        })
        const executionIds = executions.map((execution) => execution.id)

        if (executionIds.length > 0) {
          await tx.agentOutput.deleteMany({
            where: { executionId: { in: executionIds } },
          })
        }

        await tx.execution.deleteMany({
          where: { taskId: { in: taskIds } },
        })
        await tx.approval.deleteMany({
          where: { taskId: { in: taskIds } },
        })
        await tx.agentFeedback.deleteMany({
          where: { taskId: { in: taskIds } },
        })
        await tx.conversation.deleteMany({
          where: { taskId: { in: taskIds } },
        })
      }

      await tx.file.deleteMany({ where: { projectId } })
      await tx.task.deleteMany({ where: { projectId } })
      await tx.knowledgeItem.deleteMany({ where: { projectId } })
      await tx.projectProfile.deleteMany({ where: { projectId } })
      await tx.billing.deleteMany({ where: { projectId } })
      await tx.projectMember.deleteMany({ where: { projectId } })
      await tx.project.delete({ where: { id: projectId } })
    })

    return reply.code(204).send()
  })

  // POST /api/projects/:projectId/members
  app.post('/:projectId/members', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const userId = request.user.sub
    const body = AddProjectMemberSchema.parse(request.body)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership || membership.role === MemberRole.VIEWER) {
      return reply.forbidden('Insufficient permissions')
    }

    // Only an OWNER may grant the OWNER role (R7)
    if (body.role === MemberRole.OWNER && membership.role !== MemberRole.OWNER) {
      return reply.code(403).send({ error: 'Only an OWNER may grant the OWNER role' })
    }

    const targetUser = await prisma.user.findUnique({ where: { email: body.email } })
    if (!targetUser) return reply.notFound('User not found')

    // Guard: cannot demote/remove the last OWNER (R7)
    if (body.role !== MemberRole.OWNER) {
      const existingMembership = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: targetUser.id, projectId } },
      })
      if (existingMembership?.role === MemberRole.OWNER) {
        const ownerCount = await prisma.projectMember.count({
          where: { projectId, role: MemberRole.OWNER },
        })
        if (ownerCount <= 1) {
          return reply.code(422).send({ error: 'Cannot demote or remove the last OWNER of a project' })
        }
      }
    }

    const member = await prisma.projectMember.upsert({
      where: { userId_projectId: { userId: targetUser.id, projectId } },
      update: { role: body.role },
      create: { id: randomUUID(), userId: targetUser.id, projectId, role: body.role },
    })

    return reply.code(201).send({ data: member })
  })

  // GET /api/projects/:projectId/members
  app.get('/:projectId/members', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    if (!assertUuid(reply, projectId, 'projectId')) return
    const userId = request.user.sub

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send({ data: members })
  })

  // DELETE /api/projects/:projectId/members/:memberId — remove member (OWNER only)
  app.delete('/:projectId/members/:memberId', async (request, reply) => {
    const { projectId, memberId } = request.params as { projectId: string; memberId: string }
    if (!assertUuid(reply, projectId, 'projectId')) return
    if (!assertUuid(reply, memberId, 'memberId')) return
    const userId = request.user.sub

    const callerMembership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!callerMembership) return reply.notFound('Project not found')
    if (callerMembership.role !== MemberRole.OWNER) {
      return reply.forbidden('Only an OWNER can remove members')
    }

    // Cannot remove yourself if you are the last OWNER
    if (memberId === userId) {
      const ownerCount = await prisma.projectMember.count({
        where: { projectId, role: MemberRole.OWNER },
      })
      if (ownerCount <= 1) {
        return reply.badRequest('Cannot remove the last OWNER from the project')
      }
    }

    const target = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: memberId, projectId } },
    })
    if (!target) return reply.notFound('Member not found')

    await prisma.projectMember.delete({
      where: { userId_projectId: { userId: memberId, projectId } },
    })
    return reply.code(204).send()
  })
}
