import { prisma, withProjectContext } from '@ai-marketing/db'
import {
  ClarificationResponseSchema,
  CreateTaskSchema,
  ExecuteTaskSchema,
  ExecutionStatus,
  OrchestratorWebhookPayload,
  PaginationSchema,
  ScenarioType,
  TASK_SCORE_CLARIFICATION_MAX,
  TASK_SCORE_CLARIFICATION_MIN,
  TASK_SCORE_THRESHOLD,
  TaskStatus,
  ToneOfVoice,
} from '@ai-marketing/shared'
import type { FastifyInstance } from 'fastify'
import { sseManager } from '../lib/sse'
import { scoreTask } from '../services/scoring'

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

    // Score the task (§11.1 ТЗ)
    const scoring = await scoreTask(body.input)

    const task = await withProjectContext(projectId, userId, async (tx) => {
      let status: TaskStatus
      let clarificationNote: string | null = null

      if (scoring.score < TASK_SCORE_THRESHOLD) {
        // Below 25 — reject immediately
        status = TaskStatus.REJECTED
      } else if (scoring.score >= TASK_SCORE_CLARIFICATION_MIN && scoring.score <= TASK_SCORE_CLARIFICATION_MAX) {
        // 25–39 — request clarification (§11.2 Вариант B)
        status = TaskStatus.AWAITING_CLARIFICATION
        clarificationNote = scoring.clarificationQuestions?.join('\n') ?? null
      } else {
        // 40+ — accept immediately
        status = TaskStatus.PENDING
      }

      return tx.task.create({
        data: {
          projectId,
          input: body.input,
          score: scoring.score,
          scenario: scoring.isValid ? (scoring.scenario as ScenarioType) : null,
          status,
          clarificationNote,
          ...(status === TaskStatus.REJECTED && { rejectedAt: new Date() }),
        },
      })
    })

    if (task.status === TaskStatus.REJECTED) {
      return reply.code(422).send({
        error: 'Task rejected',
        code: 'TASK_SCORE_TOO_LOW',
        details: {
          score: String(scoring.score),
          threshold: String(TASK_SCORE_THRESHOLD),
          reasoning: scoring.reasoning,
        },
      })
    }

    if (task.status === TaskStatus.AWAITING_CLARIFICATION) {
      return reply.code(202).send({
        data: task,
        message: 'Task requires clarification before it can be processed',
        clarificationQuestions: scoring.clarificationQuestions ?? [],
      })
    }

    return reply.code(201).send({
      data: task,
      scoring: {
        score: scoring.score,
        scenario: scoring.scenario,
        reasoning: scoring.reasoning,
        isValid: scoring.isValid,
      },
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

    return withProjectContext(projectId, userId, async (tx) => {
      const task = await tx.task.findFirst({ where: { id: taskId, projectId } })
      if (!task) return reply.notFound('Task not found')
      if (task.status !== TaskStatus.AWAITING_CLARIFICATION) {
        return reply.badRequest('Task is not awaiting clarification')
      }

      // Re-score with the enriched input (original + clarification answers)
      const enrichedInput = `${task.input}\n\nКлиент уточнил:\n${body.answer}`
      const scoring = await scoreTask(enrichedInput)

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
        return reply.code(422).send({
          data: updated,
          error: 'Task rejected after clarification',
          code: 'TASK_SCORE_TOO_LOW',
        })
      }

      return reply.send({
        data: updated,
        ...(updated.status === TaskStatus.AWAITING_CLARIFICATION && {
          clarificationQuestions: scoring.clarificationQuestions ?? [],
        }),
      })
    })
  })

  // GET /api/projects/:projectId/tasks
  app.get('/', async (request, reply) => {
    const { projectId } = request.params as { projectId: string }
    const userId = request.user.sub
    const query = PaginationSchema.parse(request.query)

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    return withProjectContext(projectId, userId, async (tx) => {
      const [tasks, total] = await tx.$transaction([
        tx.task.findMany({
          where: { projectId },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: { createdAt: 'desc' },
        }),
        tx.task.count({ where: { projectId } }),
      ])
      return reply.send({ data: tasks, total, page: query.page, pageSize: query.pageSize })
    })
  })

  // GET /api/projects/:projectId/tasks/:taskId
  app.get('/:taskId', async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string }
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

  // POST /api/projects/:projectId/tasks/:taskId/execute
  app.post('/:taskId/execute', async (request, reply) => {
    const { projectId, taskId } = request.params as { projectId: string; taskId: string }
    const userId = request.user.sub
    const body = ExecuteTaskSchema.parse(request.body ?? {})

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    })
    if (!membership) return reply.notFound('Project not found')

    // Fetch task and project profile together (§11.5 ТЗ — profile is required to start)
    const [task, profile] = await withProjectContext(projectId, userId, async (tx) => {
      return Promise.all([
        tx.task.findFirst({ where: { id: taskId, projectId } }),
        tx.projectProfile.findUnique({ where: { projectId } }),
      ])
    })

    if (!task) return reply.notFound('Task not found')
    if (task.status === TaskStatus.REJECTED) return reply.badRequest('Task was rejected')
    if (task.status === TaskStatus.RUNNING) return reply.conflict('Task is already running')
    if (task.status === TaskStatus.AWAITING_CLARIFICATION) {
      return reply.badRequest('Task requires clarification before execution')
    }

    // §11.5 ТЗ — profile must be filled before running agents
    if (!profile) {
      return reply.code(422).send({
        error: 'Project profile is required before executing tasks',
        code: 'PROFILE_MISSING',
      })
    }

    const scenario = (body.scenario ?? task.scenario) as ScenarioType
    if (!scenario) return reply.badRequest('No scenario available for this task')

    const apiBaseUrl = process.env.API_BASE_URL?.trim()
    if (!apiBaseUrl) {
      return reply.code(500).send({
        error: 'API_BASE_URL is required before executing tasks',
        code: 'API_BASE_URL_MISSING',
      })
    }

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL?.trim()?.replace(/\/$/, '')
    if (!n8nWebhookUrl) {
      return reply.code(500).send({
        error: 'N8N_WEBHOOK_URL is required before executing tasks',
        code: 'N8N_WEBHOOK_URL_MISSING',
      })
    }

    // Create execution record
    const execution = await withProjectContext(projectId, userId, async (tx) => {
      const exec = await tx.execution.create({
        data: { taskId, projectId, scenario, status: ExecutionStatus.RUNNING },
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
        return reply.code(502).send({
          error: 'Failed to trigger n8n webhook',
          code: 'N8N_TRIGGER_FAILED',
          details: { status: triggerResponse.status },
        })
      }
    } catch (err) {
      await markTriggerFailed()
      app.log.error({ err, executionId: execution.id }, 'Failed to trigger n8n webhook')
      return reply.code(502).send({
        error: 'Failed to trigger n8n webhook',
        code: 'N8N_TRIGGER_FAILED',
      })
    }

    return reply.code(202).send({ data: execution })
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
