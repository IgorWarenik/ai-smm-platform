import { randomUUID } from 'crypto'
import { prisma, withProjectContext } from '@ai-marketing/db'
import { getRedis, MODEL_LAST_ERROR_KEY, MODEL_LAST_ERROR_TTL } from '../lib/redis-client'
import { withTimeout } from '../lib/utils'
import {
  ClarificationResponseSchema,
  CreateTaskSchema,
  ExecuteTaskSchema,
  AgentType,
  ExecutionStatus,
  OrchestratorWebhookPayload,
  ScenarioType,
  TASK_SCORE_CLARIFICATION_MAX,
  TASK_SCORE_CLARIFICATION_MIN,
  TASK_SCORE_THRESHOLD,
  TaskQuerySchema,
  TaskStatus,
  ToneOfVoice,
} from '@ai-marketing/shared'
import { runAgent } from '@ai-marketing/ai-engine'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { z } from 'zod'
import { sseManager } from '../lib/sse'
import { scoreTask } from '../services/scoring'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const AGENT_CALL_TIMEOUT_MS = Number(process.env.AGENT_CALL_TIMEOUT_MS || 20000)

async function writeModelError(err: unknown): Promise<void> {
  try {
    const redis = getRedis()
    if (!redis) return
    const provider = process.env.MODEL_PROVIDER ?? 'CLAUDE'
    const message = err instanceof Error ? err.message : String(err)
    await redis.set(MODEL_LAST_ERROR_KEY, JSON.stringify({ provider, message, timestamp: new Date().toISOString() }), 'EX', MODEL_LAST_ERROR_TTL)
  } catch { /* non-critical */ }
}
const DIRECT_SCENARIO_A_CONTENT_KEYWORDS = [
  'напиши',
  'пост',
  'текст',
  'контент',
  'статья',
  'caption',
  'write',
  'copy',
  'script',
]

function assertUuid(reply: FastifyReply, value: string, label: string): boolean {
  if (!UUID_RE.test(value)) {
    reply.badRequest(`${label} must be a valid UUID`)
    return false
  }
  return true
}



function buildProfileContext(profile: {
  companyName: string
  description: string
  niche: string
  geography: string
  products: unknown
  audience: unknown
  usp: string | null
  tov: unknown
  keywords: string[]
  forbidden: string[]
}) {
  const audience = Array.isArray(profile.audience) ? profile.audience : []
  const audienceLines = audience
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const audienceItem = item as { segment?: unknown; portrait?: unknown }
      if (!audienceItem.segment || !audienceItem.portrait) return null
      return `- ${String(audienceItem.segment)}: ${String(audienceItem.portrait)}`
    })
    .filter(Boolean)

  return [
    '## Контекст проекта',
    `**Компания:** ${profile.companyName}`,
    `**Описание:** ${profile.description}`,
    `**Ниша:** ${profile.niche}`,
    `**География:** ${profile.geography}`,
    profile.usp ? `**УТП:** ${profile.usp}` : null,
    profile.tov ? `**Тон голоса:** ${String(profile.tov)}` : null,
    profile.keywords.length ? `**Обязательные слова:** ${profile.keywords.join(', ')}` : null,
    profile.forbidden.length ? `**Запрещённые слова:** ${profile.forbidden.join(', ')}` : null,
    audienceLines.length ? `**Аудитория:**\n${audienceLines.join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function buildScenarioAFallbackOutput(
  input: string,
  agentType: AgentType,
  profile: Parameters<typeof buildProfileContext>[0]
) {
  const keywordLine = profile.keywords.length ? `\nКлючевые слова: ${profile.keywords.join(', ')}` : ''
  const forbiddenLine = profile.forbidden.length ? `\nИзбегать: ${profile.forbidden.join(', ')}` : ''
  const intro =
    agentType === AgentType.CONTENT_MAKER
      ? 'Локальный черновик контента'
      : 'Локальный маркетинговый черновик'

  return `${intro}

Задача: ${input}
Бренд: ${profile.companyName}
Ниша: ${profile.niche}
Тон: ${String(profile.tov || ToneOfVoice.FRIENDLY)}${keywordLine}${forbiddenLine}

Instagram post:

${profile.companyName} помогает людям увидеть ценность в том, что важно уже сегодня.

Наша миссия — делать ${profile.niche.toLowerCase()} понятнее, ближе и полезнее для аудитории. Мы соединяем опыт, внимание к деталям и живую коммуникацию, чтобы каждый контакт с брендом давал ощущение ясности и доверия.

Визуальная идея:
Команда или продукт в естественной рабочей среде, светлый кадр, акцент на людях, процессе и уверенном движении вперед.

Caption:
Мы верим, что сильный бренд начинается с понятной миссии. Для нас это не просто слова, а ежедневный ориентир: быть полезными, честными и создавать решения, которые помогают расти.

CTA:
Расскажите в комментариях, какая миссия вдохновляет вас в работе.

Note: выбранный model provider сейчас недоступен, поэтому создан локальный fallback-черновик.`
}

async function runScenarioADirect(
  app: FastifyInstance,
  projectId: string,
  userId: string,
  executionId: string,
  taskId: string,
  input: string,
  taskScore: number | null,
  profile: Parameters<typeof buildProfileContext>[0]
) {
  const normalizedInput = input.toLowerCase()
  const agentType = DIRECT_SCENARIO_A_CONTENT_KEYWORDS.some((keyword) => normalizedInput.includes(keyword))
    ? AgentType.CONTENT_MAKER
    : AgentType.MARKETER
  const profileContext = buildProfileContext(profile)
  const maxTokens =
    agentType === AgentType.CONTENT_MAKER
      ? Number(process.env.MAX_TOKENS_CONTENT_GENERATION || 4096)
      : Number(process.env.MAX_TOKENS_MARKETER_BRIEF || 2400)
  const systemPrompt =
    agentType === AgentType.CONTENT_MAKER
      ? `You are a Senior Content Strategist & Copywriter. Create professional content for the requested task. Use Russian language unless specified. Be specific, platform-native, and ready-to-publish.\n\n${profileContext}`
      : `You are a Senior Marketing Strategist. Analyze and develop effective marketing recommendations. Use Russian language unless specified. Be specific and actionable.\n\n${profileContext}`

  try {
    const output = await withTimeout(
      runAgent({
        systemPrompt,
        userMessage: input,
        maxTokens,
        operation: `scenario-a.${agentType.toLowerCase()}.direct`,
        semanticCacheKey: `scenario-a.direct:${taskId}`,
        cacheSystemPrompt: true,
        telemetry: {
          taskId,
          projectId,
          scenario: ScenarioType.A,
        },
        onUsage: async ({ totalTokens }) => {
          await prisma.billing.updateMany({
            where: { projectId },
            data: { tokensUsed: { increment: BigInt(totalTokens) } },
          })
        },
      }),
      AGENT_CALL_TIMEOUT_MS,
      `Scenario A ${agentType} call`
    )

    await withProjectContext(projectId, userId, async (tx) => {
      await tx.agentOutput.create({
        data: {
          id: randomUUID(),
          executionId,
          agentType,
          output,
          iteration: 1,
        },
      })
      await tx.execution.update({
        where: { id: executionId },
        data: { status: ExecutionStatus.COMPLETED, finishedAt: new Date() },
      })
      await tx.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.AWAITING_APPROVAL },
      })
    })

    void sseManager.publish(taskId, {
      type: 'agent.output',
      executionId,
      agentType,
      content: output,
      iteration: 1,
      taskScore: taskScore ?? undefined,
      timestamp: new Date().toISOString(),
    })
    void sseManager.publish(taskId, {
      type: 'execution.completed',
      executionId,
      requiresReview: false,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    app.log.warn({ err, executionId }, 'Direct Scenario A provider call failed, using local fallback output')
    void writeModelError(err)
    const output = buildScenarioAFallbackOutput(input, agentType, profile)
    await withProjectContext(projectId, userId, async (tx) => {
      await tx.agentOutput.create({
        data: {
          id: randomUUID(),
          executionId,
          agentType,
          output,
          iteration: 1,
        },
      })
      await tx.execution.update({
        where: { id: executionId },
        data: { status: ExecutionStatus.COMPLETED, finishedAt: new Date() },
      })
      await tx.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.AWAITING_APPROVAL },
      })
    })
    void sseManager.publish(taskId, {
      type: 'agent.output',
      executionId,
      agentType,
      content: output,
      iteration: 1,
      fallback: true,
      timestamp: new Date().toISOString(),
    })
    void sseManager.publish(taskId, {
      type: 'execution.completed',
      executionId,
      requiresReview: false,
      timestamp: new Date().toISOString(),
    })
  }
}

async function startTaskExecution(
  app: FastifyInstance,
  projectId: string,
  taskId: string,
  userId: string,
  scenarioOverride?: ScenarioType
) {
  // Fetch task and project profile together (§11.5 ТЗ — profile is required to start)
  const [task, profile] = await withProjectContext(projectId, userId, async (tx) => {
    return Promise.all([
      tx.task.findFirst({ where: { id: taskId, projectId } }),
      tx.projectProfile.findUnique({ where: { projectId } }),
    ])
  })

  if (!task) {
    return {
      ok: false as const,
      statusCode: 404,
      payload: { error: 'Task not found', code: 'TASK_NOT_FOUND' },
    }
  }
  if (task.status === TaskStatus.REJECTED) {
    return {
      ok: false as const,
      statusCode: 400,
      payload: { error: 'Task was rejected', code: 'TASK_REJECTED' },
    }
  }
  if (task.status === TaskStatus.RUNNING) {
    return {
      ok: false as const,
      statusCode: 409,
      payload: { error: 'Task is already running', code: 'TASK_ALREADY_RUNNING' },
    }
  }
  if (task.status === TaskStatus.AWAITING_CLARIFICATION) {
    return {
      ok: false as const,
      statusCode: 400,
      payload: {
        error: 'Task requires clarification before execution',
        code: 'TASK_REQUIRES_CLARIFICATION',
      },
    }
  }

  // §11.5 ТЗ — profile must be filled before running agents
  if (!profile) {
    return {
      ok: false as const,
      statusCode: 422,
      payload: {
        error: 'Project profile is required before executing tasks',
        code: 'PROFILE_MISSING',
      },
    }
  }

  const scenario = (scenarioOverride ?? task.scenario) as ScenarioType | null
  if (!scenario) {
    return {
      ok: false as const,
      statusCode: 400,
      payload: { error: 'No scenario available for this task', code: 'SCENARIO_MISSING' },
    }
  }

  const apiBaseUrl = process.env.API_BASE_URL?.trim()
  if (!apiBaseUrl) {
    return {
      ok: false as const,
      statusCode: 500,
      payload: {
        error: 'API_BASE_URL is required before executing tasks',
        code: 'API_BASE_URL_MISSING',
      },
    }
  }

  const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL?.trim()?.replace(/\/$/, '')
  if (!n8nWebhookUrl) {
    return {
      ok: false as const,
      statusCode: 500,
      payload: {
        error: 'N8N_WEBHOOK_URL is required before executing tasks',
        code: 'N8N_WEBHOOK_URL_MISSING',
      },
    }
  }

  // Create execution record
  const execution = await withProjectContext(projectId, userId, async (tx) => {
    const exec = await tx.execution.create({
      data: { id: randomUUID(), taskId, projectId, scenario, status: ExecutionStatus.RUNNING },
    })
    await tx.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.RUNNING },
    })
    return exec
  })

  // Build payload with project profile injected for agents (§6.3 / §12.1 ТЗ)
  const payload: OrchestratorWebhookPayload = {
    executionId: execution.id,
    taskId,
    projectId,
    input: task.input,
    scenario,
    taskScore: task.score ?? undefined,
    callbackUrl: `${apiBaseUrl}/api/internal/callback`,
    projectProfile: {
      companyName: profile.companyName,
      description: profile.description,
      niche: profile.niche,
      geography: profile.geography,
      products: profile.products as object[],
      audience: profile.audience as object[],
      usp: profile.usp,
      competitors: profile.competitors as object[],
      tov: profile.tov as unknown as ToneOfVoice,
      keywords: profile.keywords,
      forbidden: profile.forbidden,
    },
  }

  const markTriggerFailed = async () => {
    await withProjectContext(projectId, userId, async (tx) => {
      await tx.execution.update({
        where: { id: execution.id },
        data: { status: ExecutionStatus.FAILED, finishedAt: new Date() },
      })
      await tx.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.FAILED },
      })
    })
  }

  const startDirectScenarioAFallback = async (reason: unknown) => {
    app.log.warn({ reason, executionId: execution.id }, 'Starting direct Scenario A fallback')
    await withProjectContext(projectId, userId, async (tx) => {
      await tx.execution.update({
        where: { id: execution.id },
        data: { status: ExecutionStatus.RUNNING, finishedAt: null },
      })
      await tx.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.RUNNING },
      })
    })
    void runScenarioADirect(app, projectId, userId, execution.id, taskId, task.input, task.score, profile)
    return { ok: true as const, execution }
  }

  if (scenario === ScenarioType.A) {
    return startDirectScenarioAFallback('Scenario A runs directly from API')
  }

  try {
    const triggerResponse = await fetch(`${n8nWebhookUrl}/orchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': process.env.N8N_API_KEY ?? '',
      },
      body: JSON.stringify(payload),
    })

    if (!triggerResponse.ok) {
      const details = await triggerResponse.text().catch(() => '')
      await markTriggerFailed()
      app.log.error(
        { status: triggerResponse.status, details, executionId: execution.id },
        'n8n webhook rejected task execution'
      )
      return {
        ok: false as const,
        statusCode: 502,
        payload: {
          error: 'Failed to trigger n8n webhook',
          code: 'N8N_TRIGGER_FAILED',
          details: { status: triggerResponse.status },
        },
      }
    }
  } catch (err) {
    await markTriggerFailed()
    app.log.error({ err, executionId: execution.id }, 'Failed to trigger n8n webhook')
    return {
      ok: false as const,
      statusCode: 502,
      payload: {
        error: 'Failed to trigger n8n webhook',
        code: 'N8N_TRIGGER_FAILED',
      },
    }
  }

  return { ok: true as const, execution }
}

async function scoreAndStartTask(
  app: FastifyInstance,
  projectId: string,
  taskId: string,
  userId: string,
  input: string
) {
  try {
    const scoring = await scoreTask(input)
    let status: TaskStatus
    let clarificationNote: string | null = null

    if (scoring.score < TASK_SCORE_THRESHOLD) {
      status = TaskStatus.REJECTED
    } else if (scoring.score >= TASK_SCORE_CLARIFICATION_MIN && scoring.score <= TASK_SCORE_CLARIFICATION_MAX) {
      status = TaskStatus.AWAITING_CLARIFICATION
      clarificationNote = scoring.clarificationQuestions?.join('\n') ?? null
    } else {
      status = TaskStatus.PENDING
    }

    const updated = await withProjectContext(projectId, userId, async (tx) => {
      return tx.task.update({
        where: { id: taskId },
        data: {
          score: scoring.score,
          scenario: scoring.isValid ? (scoring.scenario as ScenarioType) : null,
          status,
          clarificationNote,
          ...(status === TaskStatus.REJECTED && { rejectedAt: new Date() }),
        },
      })
    })

    void sseManager.publish(taskId, {
      type: 'task.updated',
      status: updated.status,
      timestamp: new Date().toISOString(),
    })

    if (updated.status === TaskStatus.PENDING) {
      const started = await startTaskExecution(app, projectId, taskId, userId)
      if (!started.ok) {
        app.log.error({ taskId, projectId, payload: started.payload }, 'Failed to start task after background scoring')
      }
    }
  } catch (err) {
    app.log.error({ err, taskId, projectId }, 'Background task scoring failed')
    await withProjectContext(projectId, userId, async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: { status: TaskStatus.FAILED },
      })
    })
  }
}

export async function taskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate)

  // POST /api/projects/:projectId/tasks
  app.post('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const userId = request.user.sub
    const body = CreateTaskSchema.parse(request.body)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    const profile = await prisma.projectProfile.findUnique({
      where: { projectId },
    })
    if (!profile) {
      return reply.code(422).send({
        error: 'Project profile is required before executing tasks',
        code: 'PROFILE_MISSING',
      })
    }

    const task = await withProjectContext(projectId, userId, async (tx) => {
      return tx.task.create({
        data: {
          id: randomUUID(),
          projectId,
          input: body.input,
          status: TaskStatus.QUEUED,
        },
      })
    })

    void scoreAndStartTask(app, projectId, task.id, userId, body.input)

    return reply.code(201).send({
      data: task,
    })
  })

  // POST /api/projects/:projectId/tasks/:taskId/clarify
  // Client provides answers to clarification questions (§11.2 ТЗ)
  app.post('/:taskId/clarify', async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string }
    const userId = request.user.sub
    const body = ClarificationResponseSchema.parse(request.body)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    const result = await withProjectContext(projectId, userId, async (tx) => {
      const task = await tx.task.findFirst({ where: { id: taskId, projectId } })
      if (!task) return { kind: 'notFound' as const }
      if (task.status !== TaskStatus.AWAITING_CLARIFICATION) {
        return { kind: 'badRequest' as const }
      }

      // Re-score with the enriched input (original + clarification answers)
      const enrichedInput = `${task.input}\n\nКлиент уточнил:\n${body.answer}`
      let scoring: Awaited<ReturnType<typeof scoreTask>>
      try {
        scoring = await scoreTask(enrichedInput)
      } catch (err) {
        app.log.error({ err }, 'Failed to score clarified task')
        return { kind: 'scoringUnavailable' as const }
      }

      let status: TaskStatus
      let clarificationNote: string | null = null

      if (scoring.score < TASK_SCORE_THRESHOLD) {
        status = TaskStatus.REJECTED
      } else if (scoring.score >= TASK_SCORE_CLARIFICATION_MIN && scoring.score <= TASK_SCORE_CLARIFICATION_MAX) {
        status = TaskStatus.AWAITING_CLARIFICATION
        clarificationNote = scoring.clarificationQuestions?.join('\n') ?? null
      } else {
        status = TaskStatus.PENDING
      }

      const updated = await tx.task.update({
        where: { id: taskId },
        data: {
          input: enrichedInput,
          score: scoring.score,
          scenario: scoring.isValid ? (scoring.scenario as ScenarioType) : null,
          status,
          clarificationNote,
          ...(status === TaskStatus.REJECTED && { rejectedAt: new Date() }),
        },
      })

      if (updated.status === TaskStatus.REJECTED) {
        return { kind: 'rejected' as const, updated }
      }

      return {
        kind: 'ok' as const,
        updated,
        clarificationQuestions: scoring.clarificationQuestions ?? [],
      }
    })

    if (result.kind === 'notFound') return reply.notFound('Task not found')
    if (result.kind === 'badRequest') return reply.badRequest('Task is not awaiting clarification')
    if (result.kind === 'scoringUnavailable') {
      return reply.code(502).send({
        error: 'AI scoring is unavailable. Check the selected model provider API key, credits, or billing.',
        code: 'AI_SCORING_UNAVAILABLE',
      })
    }
    if (result.kind === 'rejected') {
      return reply.code(422).send({
        data: result.updated,
        error: 'Task rejected after clarification',
        code: 'TASK_SCORE_TOO_LOW',
      })
    }

    if (result.updated.status === TaskStatus.PENDING) {
      const started = await startTaskExecution(app, projectId, result.updated.id, userId)
      const startedTask = await withProjectContext(projectId, userId, async (tx) => {
        return tx.task.findFirst({
          where: { id: result.updated.id, projectId },
          include: { executions: { include: { agentOutputs: true } } },
        })
      })

      if (!started.ok) {
        if (started.payload.code === 'N8N_TRIGGER_FAILED') {
          return reply.send({
            data: startedTask ?? result.updated,
            workflowStartError: started.payload,
          })
        }

        return reply.code(started.statusCode).send(started.payload)
      }

      return reply.send({
        data: startedTask ?? result.updated,
        execution: started.execution,
      })
    }

    return reply.send({
      data: result.updated,
      ...(result.updated.status === TaskStatus.AWAITING_CLARIFICATION && {
        clarificationQuestions: result.clarificationQuestions,
      }),
    })
  })

  // GET /api/projects/:projectId/tasks
  app.get('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    if (!assertUuid(reply, projectId, 'projectId')) return
    const userId = request.user.sub
    const query = TaskQuerySchema.parse(request.query)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    return withProjectContext(projectId, userId, async (tx) => {
      const whereClause = { projectId, ...(query.status && { status: query.status }) }

      const [tasks, total] = await Promise.all([
        tx.task.findMany({
          where: whereClause,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        tx.task.count({ where: whereClause }),
      ])
      return reply.send({ data: tasks, total, page: query.page, pageSize: query.pageSize })
    })
  })

  // GET /api/projects/:projectId/tasks/:taskId
  app.get('/:taskId', async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string }
    if (!assertUuid(reply, projectId, 'projectId')) return
    if (!assertUuid(reply, taskId, 'taskId')) return
    const userId = request.user.sub

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    return withProjectContext(projectId, userId, async (tx) => {
      const task = await tx.task.findFirst({
        where: { id: taskId, projectId },
        include: { executions: { include: { agentOutputs: true } } },
      })
      if (!task) return reply.notFound('Task not found')
      return reply.send({ data: task })
    })
  })

  // DELETE /api/projects/:projectId/tasks/:taskId
  app.delete('/:taskId', async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string }
    if (!assertUuid(reply, projectId, 'projectId')) return
    if (!assertUuid(reply, taskId, 'taskId')) return
    const userId = request.user.sub

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.projectId !== projectId) return reply.notFound('Task not found')

    await prisma.$transaction(async (tx) => {
      const executions = await tx.execution.findMany({
        where: { taskId },
        select: { id: true },
      })
      const executionIds = executions.map((execution) => execution.id)

      if (executionIds.length > 0) {
        await tx.agentOutput.deleteMany({
          where: { executionId: { in: executionIds } },
        })
      }

      await tx.execution.deleteMany({ where: { taskId } })
      await tx.approval.deleteMany({ where: { taskId } })
      await tx.agentFeedback.deleteMany({ where: { taskId } })
      await tx.conversation.deleteMany({ where: { taskId } })
      await tx.file.deleteMany({ where: { taskId } })
      await tx.task.delete({ where: { id: taskId } })
    })

    return reply.code(204).send()
  })

  // PATCH /api/projects/:projectId/tasks/:taskId
  app.patch('/:taskId', async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string }
    if (!assertUuid(reply, projectId, 'projectId')) return
    if (!assertUuid(reply, taskId, 'taskId')) return
    const userId = request.user.sub

    const body = z.object({ input: z.string().min(1).max(5000) }).parse(request.body)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.projectId !== projectId) return reply.notFound('Task not found')

    const editableStatuses: string[] = ['PENDING', 'REJECTED']
    if (!editableStatuses.includes(task.status)) {
      return reply.badRequest(`Task cannot be edited in status ${task.status}`)
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { input: body.input },
    })

    return reply.send({ data: updated })
  })

  // POST /api/projects/:projectId/tasks/:taskId/execute
  app.post('/:taskId/execute', async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string }
    const userId = request.user.sub
    const body = ExecuteTaskSchema.parse(request.body ?? {})

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    const started = await startTaskExecution(app, projectId, taskId, userId, body.scenario)
    if (!started.ok) return reply.code(started.statusCode).send(started.payload)

    return reply.code(202).send({ data: started.execution })
  })

  // GET /api/projects/:projectId/tasks/:taskId/stream (SSE)
  app.get('/:taskId/stream', async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string }
    const userId = request.user.sub

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    const task = await withProjectContext(projectId, userId, async (tx) => {
      return tx.task.findFirst({ where: { id: taskId, projectId } })
    })
    if (!task) return reply.notFound('Task not found')

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const send = (data: object) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    sseManager.register(taskId, send)
    send({ type: 'connected', taskId })

    request.raw.on('close', () => {
      sseManager.unregister(taskId, send)
    })

    const keepAlive = setInterval(() => {
      reply.raw.write(': ping\n\n')
    }, 15000)

    request.raw.on('close', () => clearInterval(keepAlive))
  })
}
