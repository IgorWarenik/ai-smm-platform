import { prisma } from '@ai-marketing/db'
import { LoginSchema, RefreshTokenSchema, RegisterSchema } from '@ai-marketing/shared'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import type { FastifyInstance } from 'fastify'
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } from '../plugins/jwt'

function issueTokenPair(app: FastifyInstance, userId: string, email: string) {
  const accessToken = app.jwt.sign(
    { sub: userId, email, type: 'access' as const, jti: randomUUID() },
    { expiresIn: ACCESS_TOKEN_TTL },
  )
  const refreshToken = app.jwt.sign(
    { sub: userId, email, type: 'refresh' as const, jti: randomUUID() },
    { expiresIn: REFRESH_TOKEN_TTL },
  )
  return { accessToken, refreshToken }
}

async function persistRefreshToken(userId: string, token: string) {
  await prisma.refreshToken.create({
    data: {
      id: randomUUID(),
      token,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post('/register', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
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

    await persistRefreshToken(user.id, tokens.refreshToken)

    return reply.code(201).send({
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        tokens,
      },
    })
  })

  // POST /api/auth/login
  app.post('/login', {
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (request, reply) => {
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

    await persistRefreshToken(user.id, tokens.refreshToken)

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

    // Check revocation and existence
    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: body.refreshToken },
    })

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return reply.unauthorized('Invalid or expired refresh token')
    }

    // Token Reuse Detection: If token is already revoked, someone might be attempting a replay attack.
    // In a strict security model, you might want to revoke ALL tokens for this user here.
    if (storedToken.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { userId: storedToken.userId },
        data: { revokedAt: new Date() }
      })
      return reply.unauthorized('Refresh token reuse detected')
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    if (!user) {
      return reply.unauthorized('User not found')
    }

    const tokens = issueTokenPair(app, user.id, user.email)

    // Revoke old token (rotation)
    await prisma.refreshToken.update({
      where: { token: body.refreshToken },
      data: { revokedAt: new Date() },
    })

    await persistRefreshToken(user.id, tokens.refreshToken)

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

  // POST /api/auth/logout
  app.post('/logout', { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = RefreshTokenSchema.parse(request.body)

    await prisma.refreshToken.updateMany({
      where: { token: body.refreshToken, userId: request.user.sub },
      data: { revokedAt: new Date() },
    })

    return reply.code(204).send()
  })
}
