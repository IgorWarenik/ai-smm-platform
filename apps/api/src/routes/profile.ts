import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { prisma, withProjectContext } from '@ai-marketing/db'
import { CreateProjectProfileSchema, UpdateProjectProfileSchema } from '@ai-marketing/shared'
import { MemberRole } from '@ai-marketing/shared'

export async function profileRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // GET /api/projects/:projectId/profile
  app.get('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const userId = request.user.sub

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    return withProjectContext(projectId, userId, async (tx) => {
      const profile = await tx.projectProfile.findUnique({ where: { projectId } })
      if (!profile) return reply.notFound('Profile not found — use PUT to create it first')
      return reply.send({ data: profile })
    })
  })

  // PUT /api/projects/:projectId/profile
  // Creates or fully replaces the profile (upsert)
  app.put('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const userId = request.user.sub
    const body = CreateProjectProfileSchema.parse(request.body)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')
    if (membership.role === MemberRole.VIEWER) return reply.forbidden('Insufficient permissions')

    return withProjectContext(projectId, userId, async (tx) => {
      const profile = await tx.projectProfile.upsert({
        where: { projectId },
        create: { id: randomUUID(), projectId, ...body },
        update: body,
      })
      return reply.send({ data: profile })
    })
  })

  // PATCH /api/projects/:projectId/profile
  // Partial update — only the supplied fields are changed
  app.patch('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const userId = request.user.sub
    const body = UpdateProjectProfileSchema.parse(request.body)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')
    if (membership.role === MemberRole.VIEWER) return reply.forbidden('Insufficient permissions')

    return withProjectContext(projectId, userId, async (tx) => {
      const existing = await tx.projectProfile.findUnique({ where: { projectId } })
      if (!existing) return reply.notFound('Profile not found — use PUT to create it first')

      const profile = await tx.projectProfile.update({
        where: { projectId },
        data: body,
      })
      return reply.send({ data: profile })
    })
  })
}
