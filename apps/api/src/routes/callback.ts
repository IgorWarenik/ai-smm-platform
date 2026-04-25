import { randomUUID, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { prisma, withProjectContext } from '@ai-marketing/db'
import { AgentResultCallbackSchema, ExecutionCompleteSchema } from '@ai-marketing/shared'
import { TaskStatus, ExecutionStatus, AgentType } from '@ai-marketing/shared'
import { runAgent, TokenLimitExceededError } from '@ai-marketing/ai-engine'
import { sseManager } from '../lib/sse'

function safeEqual(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a)
    const bb = Buffer.from(b)
    return ab.byteLength === bb.byteLength && timingSafeEqual(ab, bb)
  } catch {
    return false
  }
}

function isInternalRequest(request: { headers: Record<string, string | string[] | undefined> }): boolean {
  const expected = process.env.INTERNAL_API_TOKEN?.trim()
  if (!expected) return false
  const token = request.headers['x-internal-api-token']
  const auth = request.headers.authorization
  const candidate = typeof token === 'string' ? token : typeof auth === 'string' ? auth.replace(/^Bearer /, '') : ''
  return safeEqual(candidate, expected)
}

type ModelProvider = 'CLAUDE' | 'DEEPSEEK' | 'CHATGPT' | 'GEMINI'

function getSelectedModelProvider(): ModelProvider {
  const provider = process.env.MODEL_PROVIDER?.toUpperCase()
  if (provider === 'DEEPSEEK' || provider === 'CHATGPT' || provider === 'GEMINI') return provider
  return 'CLAUDE'
}

function isModelCompatibleWithProvider(provider: ModelProvider, model: string): boolean {
  const normalized = model.toLowerCase()
  if (provider === 'CLAUDE') return normalized.startsWith('claude-')
  if (provider === 'DEEPSEEK') return normalized.startsWith('deepseek')
  if (provider === 'CHATGPT') return normalized.startsWith('gpt-') || normalized.startsWith('o')
  return normalized.startsWith('gemini') || normalized.startsWith('models/gemini')
}

function resolveRequestedModel(model: string | undefined): string | undefined {
  if (!model) return undefined
  const provider = getSelectedModelProvider()
  return isModelCompatibleWithProvider(provider, model) ? model : undefined
}

export async function callbackRoutes(app: FastifyInstance) {
  // Fail fast at server start if internal token not configured
  app.addHook('onReady', async () => {
    if (!process.env.INTERNAL_API_TOKEN?.trim()) {
      throw new Error('INTERNAL_API_TOKEN must be set before starting the server')
    }
  })
  // POST /api/internal/agent-completion
  // Monitored model completion endpoint for n8n workflows.
  app.post('/agent-completion', async (request, reply) => {
    if (!isInternalRequest(request)) return reply.unauthorized('Invalid internal token')

    const body = request.body as {
      systemPrompt?: string
      userMessage?: string
      model?: string
      maxTokens?: number
      operation?: string
      semanticCacheKey?: string
      taskId?: string
      projectId?: string
      scenario?: string
      ragChars?: number
      ragTokens?: number
    }

    if (!body?.systemPrompt || !body?.userMessage) {
      return reply.badRequest('systemPrompt and userMessage are required')
    }

    try {
      const selectedProvider = getSelectedModelProvider()
      const requestedModel = resolveRequestedModel(body.model)
      if (body.model && !requestedModel) {
        app.log.warn(
          { selectedProvider, requestedModel: body.model },
          'Ignoring workflow model because it does not match selected model provider'
        )
      }
      // Enable prompt caching for Sonnet agent calls (min 1024 tokens).
      // Scoring uses Haiku (min 2048) with a short prompt, so skip caching there.
      const isAgentCall = body.operation ? !body.operation.includes('scoring') : true
      const output = await runAgent({
        systemPrompt: body.systemPrompt,
        userMessage: body.userMessage,
        model: requestedModel,
        maxTokens: body.maxTokens,
        operation: body.operation ?? 'n8n.agentCompletion',
        semanticCacheKey: body.semanticCacheKey,
        cacheSystemPrompt: isAgentCall,
        telemetry: {
          taskId: body.taskId,
          projectId: body.projectId,
          scenario: body.scenario,
          ragChars: body.ragChars,
          ragTokens: body.ragTokens,
        },
        onUsage: body.projectId
          ? async ({ totalTokens }) => {
              await prisma.billing.updateMany({
                where: { projectId: body.projectId },
                data: { tokensUsed: { increment: BigInt(totalTokens) } },
              })
            }
          : undefined,
      })
      return reply.send({ data: { output } })
    } catch (err) {
      if (err instanceof TokenLimitExceededError) {
        return reply.code(429).send({
          error: 'Token limit exceeded',
          code: 'TOKEN_LIMIT_EXCEEDED',
          details: {
            provider: err.provider,
            limit: String(err.limit),
            used: String(err.used),
          },
        })
      }
      throw err
    }
  })

  // POST /api/internal/callback
  // Called by n8n when an agent completes work
  app.post('/callback', async (request, reply) => {
    if (!isInternalRequest(request)) return reply.unauthorized('Invalid internal token')

    const body = AgentResultCallbackSchema.parse(request.body)

    // Find execution
    const execution = await prisma.execution.findUnique({
      where: { id: body.executionId },
      include: { task: true },
    })
    if (!execution) return reply.notFound('Execution not found')

    const { projectId } = execution
    // Internal service operations have no real user — use a constant service account ID.
    // app.user_id is required by set_config but only checked by projects_isolation policy,
    // which is not involved in these callback writes.
    const userId = process.env.INTERNAL_SERVICE_USER_ID ?? '00000000-0000-0000-0000-000000000000'

    if (body.status === 'completed') {
      // Save agent output
      await withProjectContext(projectId, userId, async (tx) => {
        await tx.agentOutput.create({
          data: {
            id: randomUUID(),
            executionId: body.executionId,
            agentType: body.agentType as AgentType,
            output: body.output,
            iteration: body.iteration,
            evalScore: body.evalScore ?? null,
          },
        })
      })

      // Emit SSE to connected frontend clients
      void sseManager.publish(execution.taskId, {
        type: 'agent.output',
        executionId: body.executionId,
        agentType: body.agentType,
        content: body.output,
        iteration: body.iteration,
        timestamp: new Date().toISOString(),
      })
    }

    // If this is the final callback (execution done)
    if (body.status === 'completed' && body.agentType !== AgentType.EVALUATOR) {
      // n8n sends a separate "execution.completed" signal with no agentType
    }

    if (body.status === 'failed') {
      await withProjectContext(projectId, userId, async (tx) => {
        await tx.execution.update({
          where: { id: body.executionId },
          data: { status: ExecutionStatus.FAILED, finishedAt: new Date() },
        })
        await tx.task.update({
          where: { id: execution.taskId },
          data: { status: TaskStatus.FAILED },
        })
      })
      void sseManager.publish(execution.taskId, {
        type: 'execution.failed',
        executionId: body.executionId,
        error: body.error,
        timestamp: new Date().toISOString(),
      })
    }

    return reply.code(200).send({ ok: true })
  })

  // POST /api/internal/execution-complete
  // Called by n8n orchestrator when the entire execution finishes.
  // iterationsFailed: true when Scenario D exhausted 3 iterations without evaluator pass.
  app.post('/execution-complete', async (request, reply) => {
    if (!isInternalRequest(request)) return reply.unauthorized('Invalid internal token')

    const { executionId, iterationsFailed } = ExecutionCompleteSchema.parse(request.body)
    const serviceUserId = process.env.INTERNAL_SERVICE_USER_ID ?? '00000000-0000-0000-0000-000000000000'

    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
    })
    if (!execution) return reply.notFound('Execution not found')

    await withProjectContext(execution.projectId, serviceUserId, async (tx) => {
      await tx.execution.update({
        where: { id: executionId },
        data: { status: ExecutionStatus.COMPLETED, finishedAt: new Date() },
      })
      await tx.task.update({
        where: { id: execution.taskId },
        data: {
          status: TaskStatus.AWAITING_APPROVAL,
          requiresReview: iterationsFailed ?? false,
        },
      })
    })

    void sseManager.publish(execution.taskId, {
      type: 'execution.completed',
      executionId,
      requiresReview: iterationsFailed ?? false,
      timestamp: new Date().toISOString(),
    })

    return reply.code(200).send({ ok: true })
  })
}
