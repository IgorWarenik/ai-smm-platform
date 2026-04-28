import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-minimum-32-chars!!'
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars!!!!'
  process.env.INTERNAL_API_TOKEN = 'test-internal-token'
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
    projectMember: { findUnique: vi.fn() },
    task: { findFirst: vi.fn() },
    agentFeedback: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(),
  },
  withProjectContext: vi.fn(),
}))

vi.mock('@ai-marketing/ai-engine', () => ({
  renderTokenPrometheusMetrics: vi.fn().mockResolvedValue(''),
  runAgent: vi.fn().mockResolvedValue('{}'),
  TokenLimitExceededError: class TokenLimitExceededError extends Error {},
  getTokenBudget: vi.fn().mockReturnValue(1000),
  makeSemanticCacheKey: vi.fn().mockReturnValue('cache-key'),
  embedText: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
  applyRagBudget: vi.fn().mockImplementation((results: unknown[]) => results),
  buildRagPack: vi.fn().mockReturnValue({ shortlist: [], promptPack: '' }),
  resolveRagBudget: vi.fn().mockReturnValue({
    maxCharsPerChunk: 1200,
    maxTotalChars: 4000,
    minSimilarity: 0.15,
  }),
}))

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
}))

vi.mock('../src/services/scoring', () => ({
  scoreTask: vi.fn(),
}))

import { buildApp } from '../src/app'
import { prisma, withProjectContext } from '@ai-marketing/db'
import bcrypt from 'bcryptjs'

const db = prisma as any
const mockBcrypt = bcrypt as any
const mockWPC = withProjectContext as any

const PROJECT_ID = 'a0000000-0000-0000-0000-000000000001'
const TASK_ID = 'b0000000-0000-0000-0000-000000000002'
const USER_ID = 'c0000000-0000-0000-0000-000000000003'

async function getToken(app: FastifyInstance): Promise<string> {
  db.user.findUnique.mockResolvedValueOnce({
    id: USER_ID,
    email: 'feedback@example.com',
    name: 'Feedback User',
    passwordHash: 'hashed_pw',
  })
  db.refreshToken.create.mockResolvedValue({})
  mockBcrypt.compare.mockResolvedValueOnce(true)

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'feedback@example.com', password: 'password123' },
  })
  return res.json().data.tokens.accessToken
}

describe('GET /api/projects/:projectId/tasks/:taskId/feedback', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(db)
    )
    mockWPC.mockImplementation(async (_pid: string, _uid: string, cb: any) => cb(db))
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('200 — member gets list', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findFirst.mockResolvedValue({ id: TASK_ID, projectId: PROJECT_ID })
    db.agentFeedback.findMany.mockResolvedValue([
      {
        id: 'feedback-1',
        projectId: PROJECT_ID,
        taskId: TASK_ID,
        agentType: 'MARKETER',
        score: 4,
        comment: 'Good output, minor tone issues',
      },
    ])
    db.agentFeedback.count.mockResolvedValue(1)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/feedback`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.data).toHaveLength(1)
    expect(body.total).toBe(1)
  })

  it('404 — non-member', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/feedback`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })

  it('404 — task not found', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/feedback`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})

describe('POST /api/projects/:projectId/tasks/:taskId/feedback', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(db)
    )
    mockWPC.mockImplementation(async (_pid: string, _uid: string, cb: any) => cb(db))
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('201 — creates feedback', async () => {
    const token = await getToken(app)
    const feedback = {
      id: 'feedback-1',
      projectId: PROJECT_ID,
      taskId: TASK_ID,
      agentType: 'MARKETER',
      score: 4,
      comment: 'Good output, minor tone issues',
    }

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findFirst.mockResolvedValue({ id: TASK_ID, projectId: PROJECT_ID })
    db.agentFeedback.create.mockResolvedValue(feedback)

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/feedback`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        agentType: 'MARKETER',
        score: 4,
        comment: 'Good output, minor tone issues',
      },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().data).toEqual(feedback)
  })

  it('400 — invalid agentType', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/feedback`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        agentType: 'INVALID',
        score: 4,
        comment: 'Good output, minor tone issues',
      },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 — score out of range', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/feedback`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        agentType: 'MARKETER',
        score: 6,
        comment: 'Good output, minor tone issues',
      },
    })

    expect(res.statusCode).toBe(400)
  })

  it('404 — non-member', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/feedback`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        agentType: 'MARKETER',
        score: 4,
        comment: 'Good output, minor tone issues',
      },
    })

    expect(res.statusCode).toBe(404)
  })

  it('404 — task not found', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/feedback`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        agentType: 'MARKETER',
        score: 4,
        comment: 'Good output, minor tone issues',
      },
    })

    expect(res.statusCode).toBe(404)
  })
})
