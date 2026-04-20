import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-minimum-32-chars!!'
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars!!!!'
  process.env.INTERNAL_API_TOKEN = 'test-internal-api-token-value!!'
})

vi.mock('@ai-marketing/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn() },
    refreshToken: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
    },
    execution: { findUnique: vi.fn(), update: vi.fn() },
    agentOutput: { create: vi.fn() },
    task: { update: vi.fn() },
    billing: { updateMany: vi.fn() },
  },
  withProjectContext: vi.fn(),
}))

vi.mock('@ai-marketing/ai-engine', () => ({
  renderTokenPrometheusMetrics: vi.fn().mockResolvedValue(''),
  runAgent: vi.fn().mockResolvedValue('AI generated output'),
  TokenLimitExceededError: class TokenLimitExceededError extends Error {
    provider = 'claude'
    limit = 500000
    used = 600000
  },
}))

// Prevent ioredis connection during SSE module load
vi.mock('../src/lib/sse', () => ({
  sseManager: {
    register: vi.fn(),
    unregister: vi.fn(),
    publish: vi.fn().mockResolvedValue(undefined),
  },
}))

import { buildApp } from '../src/app'
import { prisma, withProjectContext } from '@ai-marketing/db'

const db = prisma as any
const mockWPC = withProjectContext as any

const INTERNAL_TOKEN = 'test-internal-api-token-value!!'
const EXECUTION_ID = 'a0000000-0000-0000-0000-000000000001'
const TASK_ID = 'b0000000-0000-0000-0000-000000000002'
const PROJECT_ID = 'c0000000-0000-0000-0000-000000000003'

// ─── POST /api/internal/callback ─────────────────────────────────────────────

describe('POST /api/internal/callback', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    mockWPC.mockImplementation(async (_pid: string, _uid: string, cb: any) => cb(db))
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('401 — request without internal token rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/callback',
      payload: {
        executionId: EXECUTION_ID,
        agentType: 'MARKETER',
        output: 'Some marketing output',
        iteration: 1,
        status: 'completed',
      },
    })
    expect(res.statusCode).toBe(401)
  })

  it('200 — completed callback creates agent output', async () => {
    db.execution.findUnique.mockResolvedValue({
      id: EXECUTION_ID,
      taskId: TASK_ID,
      projectId: PROJECT_ID,
    })
    db.agentOutput.create.mockResolvedValue({ id: 'output-1', agentType: 'MARKETER' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/callback',
      headers: { 'x-internal-api-token': INTERNAL_TOKEN },
      payload: {
        executionId: EXECUTION_ID,
        agentType: 'MARKETER',
        output: 'Marketing strategy brief',
        iteration: 1,
        status: 'completed',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
    expect(db.agentOutput.create).toHaveBeenCalled()
  })

  it('200 — failed callback updates execution status', async () => {
    db.execution.findUnique.mockResolvedValue({
      id: EXECUTION_ID,
      taskId: TASK_ID,
      projectId: PROJECT_ID,
    })
    db.execution.update.mockResolvedValue({})
    db.task.update.mockResolvedValue({})

    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/callback',
      headers: { 'x-internal-api-token': INTERNAL_TOKEN },
      payload: {
        executionId: EXECUTION_ID,
        agentType: 'MARKETER',
        output: '',
        iteration: 1,
        status: 'failed',
        error: 'Agent timed out',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(db.execution.update).toHaveBeenCalled()
    expect(db.task.update).toHaveBeenCalled()
  })

  it('404 — execution not found', async () => {
    db.execution.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/callback',
      headers: { 'x-internal-api-token': INTERNAL_TOKEN },
      payload: {
        executionId: EXECUTION_ID,
        agentType: 'MARKETER',
        output: 'output',
        iteration: 1,
        status: 'completed',
      },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ─── POST /api/internal/execution-complete ────────────────────────────────────

describe('POST /api/internal/execution-complete', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    mockWPC.mockImplementation(async (_pid: string, _uid: string, cb: any) => cb(db))
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('200 — marks execution COMPLETED and task AWAITING_APPROVAL', async () => {
    db.execution.findUnique.mockResolvedValue({
      id: EXECUTION_ID,
      taskId: TASK_ID,
      projectId: PROJECT_ID,
    })
    db.execution.update.mockResolvedValue({ id: EXECUTION_ID, status: 'COMPLETED' })
    db.task.update.mockResolvedValue({ id: TASK_ID, status: 'AWAITING_APPROVAL' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/execution-complete',
      headers: { 'x-internal-api-token': INTERNAL_TOKEN },
      payload: { executionId: EXECUTION_ID },
    })

    expect(res.statusCode).toBe(200)
    // Task status set to AWAITING_APPROVAL, not COMPLETED
    const taskUpdateCall = db.task.update.mock.calls[0][0]
    expect(taskUpdateCall.data.status).toBe('AWAITING_APPROVAL')
  })

  it('200 — iterationsFailed=true sets requiresReview on task', async () => {
    db.execution.findUnique.mockResolvedValue({
      id: EXECUTION_ID,
      taskId: TASK_ID,
      projectId: PROJECT_ID,
    })
    db.execution.update.mockResolvedValue({})
    db.task.update.mockResolvedValue({})

    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/execution-complete',
      headers: { 'x-internal-api-token': INTERNAL_TOKEN },
      payload: { executionId: EXECUTION_ID, iterationsFailed: true },
    })

    expect(res.statusCode).toBe(200)
    const taskUpdateCall = db.task.update.mock.calls[0][0]
    expect(taskUpdateCall.data.requiresReview).toBe(true)
  })

  it('401 — no internal token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/execution-complete',
      payload: { executionId: EXECUTION_ID },
    })
    expect(res.statusCode).toBe(401)
  })
})

// ─── POST /api/internal/agent-completion ─────────────────────────────────────

describe('POST /api/internal/agent-completion', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('200 — returns AI output', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/agent-completion',
      headers: { 'x-internal-api-token': INTERNAL_TOKEN },
      payload: {
        systemPrompt: 'You are a marketing expert.',
        userMessage: 'Write a brief for a social media campaign.',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.output).toBe('AI generated output')
  })

  it('400 — missing required fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/agent-completion',
      headers: { 'x-internal-api-token': INTERNAL_TOKEN },
      payload: { systemPrompt: 'You are a marketing expert.' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('401 — no internal token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/internal/agent-completion',
      payload: { systemPrompt: 'You are a marketing expert.', userMessage: 'Do something.' },
    })
    expect(res.statusCode).toBe(401)
  })
})
