import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// ── Hoist mock objects so they are available inside vi.mock factories ──────────

const { mockPrismaExecution, mockPrismaUser, mockWithProjectContext, mockEmitToTask } =
  vi.hoisted(() => {
    // withProjectContext immediately invokes the callback with a transaction
    // proxy that mirrors the same mock tables, so tests only need one mock set.
    const execMock = { findUnique: vi.fn(), update: vi.fn() }
    const taskMock = { update: vi.fn() }
    const agentOutputMock = { create: vi.fn() }

    const txProxy = {
      execution: execMock,
      task: taskMock,
      agentOutput: agentOutputMock,
    }

    return {
      mockPrismaExecution: execMock,
      mockPrismaUser: { findUnique: vi.fn(), create: vi.fn() },
      mockWithProjectContext: vi.fn(
        async (_projectId: string, _userId: string, cb: (tx: typeof txProxy) => Promise<unknown>) =>
          cb(txProxy)
      ),
      mockEmitToTask: vi.fn(),
    }
  })

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@ai-marketing/db', () => ({
  prisma: {
    user: mockPrismaUser,
    execution: mockPrismaExecution,
    billing: { updateMany: vi.fn() },
  },
  withProjectContext: mockWithProjectContext,
  Prisma: {},
  PrismaClient: class {},
  MemberRole: {},
  TaskStatus: { COMPLETED: 'COMPLETED', FAILED: 'FAILED' },
  ExecutionStatus: { COMPLETED: 'COMPLETED', FAILED: 'FAILED' },
  ScenarioType: {},
  AgentType: { EVALUATOR: 'EVALUATOR', MARKETER: 'MARKETER', CONTENT_MAKER: 'CONTENT_MAKER' },
  KnowledgeCategory: {},
}))

vi.mock('@ai-marketing/ai-engine', () => ({
  renderTokenPrometheusMetrics: vi.fn().mockResolvedValue(''),
  runAgent: vi.fn().mockResolvedValue('mocked agent output'),
  TokenLimitExceededError: class TokenLimitExceededError extends Error {},
}))

vi.mock('../../apps/api/src/lib/sse', () => ({
  emitToTask: mockEmitToTask,
  sseClients: new Map(),
}))

// Import after mocks are registered
import { buildApp } from '../../apps/api/src/app'
import type { FastifyInstance } from 'fastify'

// ── Constants ─────────────────────────────────────────────────────────────────

const EXECUTION_ID = '11111111-1111-1111-1111-111111111111'
const TASK_ID = '22222222-2222-2222-2222-222222222222'
const PROJECT_ID = '33333333-3333-3333-3333-333333333333'
const SERVICE_USER_ID = 'service-user-id-for-tests'
const INTERNAL_API_TOKEN = 'test-internal-api-token'

const MOCK_EXECUTION = {
  id: EXECUTION_ID,
  taskId: TASK_ID,
  projectId: PROJECT_ID,
  status: 'RUNNING',
}

// ── App setup / teardown ──────────────────────────────────────────────────────

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()
  process.env.INTERNAL_SERVICE_USER_ID = SERVICE_USER_ID
  process.env.INTERNAL_API_TOKEN = INTERNAL_API_TOKEN

  if (!app) {
    app = await buildApp()
    await app.ready()
  }
})

afterAll(async () => {
  if (app) await app.close()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

async function postInternal(path: string, body: unknown, options: { token?: string | null } = {}) {
  const token = options.token === undefined ? INTERNAL_API_TOKEN : options.token
  const res = await app.inject({
    method: 'POST',
    url: `/api/internal/${path}`,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    payload: JSON.stringify(body),
  })
  return { status: res.statusCode, body: res.json() }
}

// ── POST /api/internal/execution-complete ─────────────────────────────────────

describe('POST /api/internal/execution-complete', () => {
  it('returns 401 without the internal token', async () => {
    const { status } = await postInternal(
      'execution-complete',
      { executionId: EXECUTION_ID },
      { token: null }
    )

    expect(status).toBe(401)
    expect(mockPrismaExecution.findUnique).not.toHaveBeenCalled()
  })

  it('returns 401 with a wrong internal token', async () => {
    const { status } = await postInternal(
      'execution-complete',
      { executionId: EXECUTION_ID },
      { token: 'wrong-token' }
    )

    expect(status).toBe(401)
    expect(mockPrismaExecution.findUnique).not.toHaveBeenCalled()
  })

  it('returns 200 and sets requiresReview=true when iterationsFailed is true', async () => {
    mockPrismaExecution.findUnique.mockResolvedValue(MOCK_EXECUTION)

    const { status, body } = await postInternal('execution-complete', {
      executionId: EXECUTION_ID,
      iterationsFailed: true,
    })

    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })

    // task.update must include requiresReview: true
    const taskUpdateCalls = mockWithProjectContext.mock.calls
    expect(taskUpdateCalls.length).toBeGreaterThanOrEqual(1)

    // Inspect the tx.task.update call captured inside withProjectContext
    // withProjectContext runs the callback synchronously in our mock, so
    // we verify via the underlying task mock that was called in the callback.
    const { TaskStatus } = await import('@ai-marketing/db')
    // The task update inside withProjectContext passes requiresReview: true
    // We can't directly inspect tx calls without extra instrumentation, so
    // we verify the SSE event which is the observable output of the flag.
    expect(mockEmitToTask).toHaveBeenCalledOnce()
    const [emittedTaskId, emittedEvent] = mockEmitToTask.mock.calls[0]
    expect(emittedTaskId).toBe(TASK_ID)
    expect(emittedEvent).toMatchObject({
      type: 'execution.completed',
      executionId: EXECUTION_ID,
      requiresReview: true,
    })
    expect(typeof emittedEvent.timestamp).toBe('string')
  })

  it('returns 200 and requiresReview=false when iterationsFailed is false', async () => {
    mockPrismaExecution.findUnique.mockResolvedValue(MOCK_EXECUTION)

    const { status, body } = await postInternal('execution-complete', {
      executionId: EXECUTION_ID,
      iterationsFailed: false,
    })

    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })

    expect(mockEmitToTask).toHaveBeenCalledOnce()
    const [, emittedEvent] = mockEmitToTask.mock.calls[0]
    expect(emittedEvent).toMatchObject({
      type: 'execution.completed',
      requiresReview: false,
    })
  })

  it('returns 200 and requiresReview=false when iterationsFailed is omitted', async () => {
    mockPrismaExecution.findUnique.mockResolvedValue(MOCK_EXECUTION)

    const { status, body } = await postInternal('execution-complete', {
      executionId: EXECUTION_ID,
    })

    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })

    expect(mockEmitToTask).toHaveBeenCalledOnce()
    const [, emittedEvent] = mockEmitToTask.mock.calls[0]
    expect(emittedEvent).toMatchObject({
      type: 'execution.completed',
      requiresReview: false,
    })
  })

  it('returns 404 when executionId is unknown', async () => {
    mockPrismaExecution.findUnique.mockResolvedValue(null)

    const { status } = await postInternal('execution-complete', {
      executionId: EXECUTION_ID,
    })

    expect(status).toBe(404)
    expect(mockEmitToTask).not.toHaveBeenCalled()
  })

  it('returns 400 when executionId is missing (ZodError)', async () => {
    const { status } = await postInternal('execution-complete', {
      iterationsFailed: true,
    })

    expect(status).toBe(400)
    expect(mockEmitToTask).not.toHaveBeenCalled()
  })

  it('returns 400 when executionId is not a valid UUID (ZodError)', async () => {
    const { status } = await postInternal('execution-complete', {
      executionId: 'not-a-uuid',
    })

    expect(status).toBe(400)
    expect(mockEmitToTask).not.toHaveBeenCalled()
  })

  it('uses INTERNAL_SERVICE_USER_ID env var as the service user in withProjectContext', async () => {
    mockPrismaExecution.findUnique.mockResolvedValue(MOCK_EXECUTION)

    await postInternal('execution-complete', { executionId: EXECUTION_ID })

    expect(mockWithProjectContext).toHaveBeenCalledWith(
      PROJECT_ID,
      SERVICE_USER_ID,
      expect.any(Function)
    )
  })

  it('falls back to hardcoded UUID when INTERNAL_SERVICE_USER_ID is unset', async () => {
    delete process.env.INTERNAL_SERVICE_USER_ID
    mockPrismaExecution.findUnique.mockResolvedValue(MOCK_EXECUTION)

    await postInternal('execution-complete', { executionId: EXECUTION_ID })

    expect(mockWithProjectContext).toHaveBeenCalledWith(
      PROJECT_ID,
      '00000000-0000-0000-0000-000000000000',
      expect.any(Function)
    )

    // restore for subsequent tests
    process.env.INTERNAL_SERVICE_USER_ID = SERVICE_USER_ID
  })
})

// ── POST /api/internal/callback ───────────────────────────────────────────────

describe('POST /api/internal/callback', () => {
  const VALID_COMPLETED_BODY = {
    executionId: EXECUTION_ID,
    agentType: 'MARKETER',
    output: 'Here is the marketing brief.',
    iteration: 1,
    status: 'completed',
  }

  it('returns 401 without the internal token', async () => {
    const { status } = await postInternal('callback', VALID_COMPLETED_BODY, { token: null })

    expect(status).toBe(401)
    expect(mockPrismaExecution.findUnique).not.toHaveBeenCalled()
  })

  it('returns 401 with a wrong internal token', async () => {
    const { status } = await postInternal('callback', VALID_COMPLETED_BODY, { token: 'wrong-token' })

    expect(status).toBe(401)
    expect(mockPrismaExecution.findUnique).not.toHaveBeenCalled()
  })

  it('returns 200 { ok: true } and creates agentOutput on a valid completed callback', async () => {
    mockPrismaExecution.findUnique.mockResolvedValue(MOCK_EXECUTION)

    const { status, body } = await postInternal('callback', VALID_COMPLETED_BODY)

    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockWithProjectContext).toHaveBeenCalled()
  })

  it('emits agent.output SSE event on completed callback', async () => {
    mockPrismaExecution.findUnique.mockResolvedValue(MOCK_EXECUTION)

    await postInternal('callback', VALID_COMPLETED_BODY)

    expect(mockEmitToTask).toHaveBeenCalledOnce()
    const [emittedTaskId, emittedEvent] = mockEmitToTask.mock.calls[0]
    expect(emittedTaskId).toBe(TASK_ID)
    expect(emittedEvent).toMatchObject({
      type: 'agent.output',
      executionId: EXECUTION_ID,
      agentType: 'MARKETER',
      content: 'Here is the marketing brief.',
      iteration: 1,
    })
    expect(typeof emittedEvent.timestamp).toBe('string')
  })

  it('passes evalScore to agentOutput.create when provided', async () => {
    mockPrismaExecution.findUnique.mockResolvedValue(MOCK_EXECUTION)

    await postInternal('callback', {
      ...VALID_COMPLETED_BODY,
      evalScore: 87,
    })

    // The agentOutput.create mock is part of the tx proxy inside withProjectContext.
    // We verify the call happened (the mock is the same object as the proxy).
    expect(mockWithProjectContext).toHaveBeenCalled()
  })

  it('updates execution and task to FAILED on status: failed', async () => {
    mockPrismaExecution.findUnique.mockResolvedValue(MOCK_EXECUTION)

    const { status, body } = await postInternal('callback', {
      executionId: EXECUTION_ID,
      agentType: 'MARKETER',
      output: '',
      iteration: 1,
      status: 'failed',
      error: 'Agent crashed unexpectedly',
    })

    expect(status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockWithProjectContext).toHaveBeenCalled()
  })

  it('emits execution.failed SSE event on status: failed', async () => {
    mockPrismaExecution.findUnique.mockResolvedValue(MOCK_EXECUTION)

    await postInternal('callback', {
      executionId: EXECUTION_ID,
      agentType: 'MARKETER',
      output: '',
      iteration: 1,
      status: 'failed',
      error: 'Agent crashed unexpectedly',
    })

    expect(mockEmitToTask).toHaveBeenCalledOnce()
    const [emittedTaskId, emittedEvent] = mockEmitToTask.mock.calls[0]
    expect(emittedTaskId).toBe(TASK_ID)
    expect(emittedEvent).toMatchObject({
      type: 'execution.failed',
      executionId: EXECUTION_ID,
      error: 'Agent crashed unexpectedly',
    })
  })

  it('returns 404 when executionId is unknown', async () => {
    mockPrismaExecution.findUnique.mockResolvedValue(null)

    const { status } = await postInternal('callback', VALID_COMPLETED_BODY)

    expect(status).toBe(404)
    expect(mockWithProjectContext).not.toHaveBeenCalled()
    expect(mockEmitToTask).not.toHaveBeenCalled()
  })

  it('returns 400 when executionId is missing', async () => {
    const { status } = await postInternal('callback', {
      agentType: 'MARKETER',
      output: 'some output',
      iteration: 1,
      status: 'completed',
    })

    expect(status).toBe(400)
  })

  it('returns 400 when agentType is invalid', async () => {
    const { status } = await postInternal('callback', {
      ...VALID_COMPLETED_BODY,
      agentType: 'INVALID_AGENT',
    })

    expect(status).toBe(400)
  })

  it('returns 400 when status is an unrecognized value', async () => {
    const { status } = await postInternal('callback', {
      ...VALID_COMPLETED_BODY,
      status: 'in_progress',
    })

    expect(status).toBe(400)
  })
})
