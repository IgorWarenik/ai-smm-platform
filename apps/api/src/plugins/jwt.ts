import jwt from '@fastify/jwt'
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

export interface JWTPayload {
  sub: string    // userId
  email: string
  type: 'access' | 'refresh'
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload
    user: JWTPayload
  }
}

export const ACCESS_TOKEN_TTL = '15m'
export const REFRESH_TOKEN_TTL = '7d'

export const jwtPlugin = fp(async (app: FastifyInstance) => {
  const hasKeys = !!(process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY)

  // Stage 5.1: Support asymmetric keys if provided, fallback to secret for dev
  await app.register(jwt, {
    secret: hasKeys
      ? { private: process.env.JWT_PRIVATE_KEY!, public: process.env.JWT_PUBLIC_KEY! }
      : (process.env.JWT_SECRET || 'dev-secret-change-in-production'),
    sign: {
      algorithm: hasKeys ? 'RS256' : 'HS256',
      expiresIn: ACCESS_TOKEN_TTL
    }
  })

  // Decorator: authenticate request — rejects refresh tokens used as access tokens
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify()
      if (request.user.type === 'refresh') {
        return reply.unauthorized('Refresh token cannot be used for API access')
      }
    } catch (err) {
      reply.unauthorized('Invalid or expired token')
    }
  })
})

// Augment FastifyInstance type
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
  }
}
