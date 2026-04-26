import Fastify from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import rateLimit from '@fastify/rate-limit'
import { ZodError } from 'zod'
import { jwtPlugin } from './plugins/jwt'
import { authRoutes } from './routes/auth'
import { projectRoutes } from './routes/projects'
import { profileRoutes } from './routes/profile'
import { taskRoutes } from './routes/tasks'
import { approvalRoutes } from './routes/approvals'
import { feedbackRoutes } from './routes/feedback'
import { knowledgeRoutes } from './routes/knowledge'
import { callbackRoutes } from './routes/callback'
import { modelConfigRoutes } from './routes/model-config'
import { renderTokenPrometheusMetrics } from '@ai-marketing/ai-engine'

function resolveAllowedOrigins() {
  const configuredOrigins = process.env.FRONTEND_URL
    ?.split(',')
    .map(origin => origin.trim())
    .filter(Boolean)

  return Array.from(new Set([
    'http://localhost:3000',
    'http://localhost:3002',
    ...(configuredOrigins ?? []),
  ]))
}

export async function buildApp() {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
  })

  // ─── Plugins ───────────────────────────────────────────────
  await app.register(cors, {
    origin: resolveAllowedOrigins(),
    credentials: true,
  })
  await app.register(sensible)
  await app.register(rateLimit, {
    global: false,
    max: 20,
    timeWindow: '1 minute',
  })
  await app.register(jwtPlugin)

  // ─── Global error handler ──────────────────────────────────
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.flatten().fieldErrors,
      })
    }
    // Re-throw for Fastify default handling (404, 401, etc.)
    reply.send(error)
  })

  // ─── Routes ────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(projectRoutes, { prefix: '/api/projects' })
  await app.register(profileRoutes, { prefix: '/api/projects/:projectId/profile' })
  await app.register(taskRoutes, { prefix: '/api/projects/:projectId/tasks' })
  await app.register(approvalRoutes, { prefix: '/api/projects/:projectId/tasks/:taskId/approvals' })
  await app.register(feedbackRoutes, { prefix: '/api/projects/:projectId/tasks/:taskId/feedback' })
  await app.register(knowledgeRoutes, { prefix: '/api/projects/:projectId/knowledge' })
  await app.register(modelConfigRoutes, { prefix: '/api/projects/:projectId/model-config' })
  await app.register(callbackRoutes, { prefix: '/api/internal' })

  // ─── Health ────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))
  app.get('/metrics', async (_request, reply) => {
    const metrics = await renderTokenPrometheusMetrics()
    return reply.header('Content-Type', 'text/plain; version=0.0.4').send(metrics)
  })

  return app
}
