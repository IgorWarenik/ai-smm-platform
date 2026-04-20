import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '@ai-marketing/db'
import { LoginSchema, RegisterSchema, RefreshTokenSchema } from '@ai-marketing/shared'
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } from '../plugins/jwt'

function issueTokenPair(app: FastifyInstance, userId: string, email: string) {
  const accessToken = app.jwt.sign(
    { sub: userId, email, type: 'access' as const },
    { expiresIn: ACCESS_TOKEN_TTL },
  )
  const refreshToken = app.jwt.sign(
    { sub: userId, email, type: 'refresh' as const },
    { expiresIn: REFRESH_TOKEN_TTL },
  )
  return { accessToken, refreshToken }
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post('/register', async (request, reply) => {
    const body = RegisterSchema.parse(request.body)

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
    })
    if (existing) {
      return reply.conflict('Email already in use')
    }

    const passwordHash = await bcrypt.hash(body.password, 10)
    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
        name: body.name ?? null,
      },
    })

    const tokens = issueTokenPair(app, user.id, user.email)

    return reply.code(201).send({
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        tokens,
      },
    })
  })

  // POST /api/auth/login
  app.post('/login', async (request, reply) => {
    const body = LoginSchema.parse(request.body)

    const user = await prisma.user.findUnique({
      where: { email: body.email },
    })
    if (!user) {
      return reply.unauthorized('Invalid credentials')
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash)
    if (!valid) {
      return reply.unauthorized('Invalid credentials')
    }

    const tokens = issueTokenPair(app, user.id, user.email)

    return reply.send({
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        tokens,
      },
    })
  })

  // POST /api/auth/refresh
  app.post('/refresh', async (request, reply) => {
    const body = RefreshTokenSchema.parse(request.body)

    let payload: { sub: string; email: string; type: string }
    try {
      payload = app.jwt.verify(body.refreshToken)
    } catch {
      return reply.unauthorized('Invalid or expired refresh token')
    }

    if (payload.type !== 'refresh') {
      return reply.unauthorized('Invalid token type')
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) {
      return reply.unauthorized('User not found')
    }

    const tokens = issueTokenPair(app, user.id, user.email)

    return reply.send({
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        tokens,
      },
    })
  })

  // GET /api/auth/me
  app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.sub },
      select: { id: true, email: true, name: true, createdAt: true },
    })
    if (!user) return reply.notFound('User not found')
    return reply.send({ data: user })
  })
}
