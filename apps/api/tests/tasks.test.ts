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
    task: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    projectProfile: { findUnique: vi.fn() },
    execution: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  withProjectContext: vi.fn(),
}))

vi.mock('@ai-marketing/ai-engine', () => ({
  renderTokenPrometheusMetrics: vi.fn().mockResolvedValue(''),
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
import { scoreTask } from '../src/services/scoring'

const db = prisma as any
const mockBcrypt = bcrypt as any
const mockScoreTask = scoreTask as any
const mockWPC = withProjectContext as any

const PROJECT_ID = 'proj-00000000-0000-0000-0000-000000000001'
const TASK_ID = 'task-0000-0000-0000-0000-000000000001'
const USER_ID = 'user-0000-0000-0000-0000-000000000001'

async function getToken(app: FastifyInstance): Promise<string> {
  db.user.findUnique.mockResolvedValueOnce({
    id: USER_ID,
    email: 'tester@example.com',
    name: 'Tester',
    passwordHash: 'hashed_pw',
  })
  db.refreshToken.create.mockResolvedValue({})
  mockBcrypt.compare.mockResolvedValueOnce(true)

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'tester@example.com', password: 'password123' },
  })
  return res.json().data.tokens.accessToken
}

// ─── POST /api/projects/:projectId/tasks ─────────────────────────────────────

describe('POST /api/projects/:projectId/tasks', () => {
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

  it('201 — score ≥ 40 creates PENDING task', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    mockScoreTask.mockResolvedValue({ score: 85, scenario: 'A', reasoning: 'Clear', isValid: true })
    db.task.create.mockResolvedValue({
      id: TASK_ID,
      projectId: PROJECT_ID,
      input: 'Create a comprehensive content strategy for Q1',
      score: 85,
      scenario: 'A',
      status: 'PENDING',
      createdAt: new Date(),
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: 'Create a comprehensive content strategy for Q1' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().data.status).toBe('PENDING')
  })

  it('202 — score 25-39 returns AWAITING_CLARIFICATION with questions', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    mockScoreTask.mockResolvedValue({
      score: 30,
      scenario: 'A',
      reasoning: 'Too vague',
      isValid: true,
      clarificationQuestions: ['Who is your target audience?', 'What is the budget?'],
    })
    db.task.create.mockResolvedValue({
      id: TASK_ID,
      projectId: PROJECT_ID,
      input: 'Do marketing stuff',
      score: 30,
      status: 'AWAITING_CLARIFICATION',
      createdAt: new Date(),
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: 'Do marketing stuff for the company' },
    })

    expect(res.statusCode).toBe(202)
    const body = res.json()
    expect(body.data.status).toBe('AWAITING_CLARIFICATION')
    expect(Array.isArray(body.clarificationQuestions)).toBe(true)
    expect(body.clarificationQuestions.length).toBeGreaterThan(0)
  })

  it('422 — score < 25 rejects task', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    mockScoreTask.mockResolvedValue({ score: 10, scenario: 'A', reasoning: 'Too vague', isValid: false })
    db.task.create.mockResolvedValue({
      id: TASK_ID,
      projectId: PROJECT_ID,
      input: 'Do stuff',
      score: 10,
      status: 'REJECTED',
      createdAt: new Date(),
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: 'Do stuff for the company campaign' },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json().code).toBe('TASK_SCORE_TOO_LOW')
  })

  it('404 — non-member cannot create task', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: 'Create a comprehensive content strategy for Q1' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('401 — unauthenticated request rejected', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks`,
      payload: { input: 'Create a comprehensive content strategy for Q1' },
    })

    expect(res.statusCode).toBe(401)
  })
})

// ─── POST /api/projects/:projectId/tasks/:taskId/clarify ──────────────────────

describe('POST /api/projects/:projectId/tasks/:taskId/clarify', () => {
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

  it('200 — provides answer, rescore → PENDING', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findFirst.mockResolvedValue({
      id: TASK_ID,
      projectId: PROJECT_ID,
      input: 'Do marketing',
      status: 'AWAITING_CLARIFICATION',
    })
    mockScoreTask.mockResolvedValue({ score: 80, scenario: 'B', reasoning: 'Now clear', isValid: true })
    db.task.update.mockResolvedValue({
      id: TASK_ID,
      input: 'Do marketing\n\nКлиент уточнил:\nTarget: SMB companies in Russia',
      score: 80,
      status: 'PENDING',
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/clarify`,
      headers: { authorization: `Bearer ${token}` },
      payload: { answer: 'Target: SMB companies in Russia' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.status).toBe('PENDING')
  })

  it('400 — task not AWAITING_CLARIFICATION', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findFirst.mockResolvedValue({
      id: TASK_ID,
      projectId: PROJECT_ID,
      input: 'Already clear task',
      status: 'PENDING',
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/clarify`,
      headers: { authorization: `Bearer ${token}` },
      payload: { answer: 'some answer' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('404 — non-member cannot clarify', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/clarify`,
      headers: { authorization: `Bearer ${token}` },
      payload: { answer: 'some answer' },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ─── GET /api/projects/:projectId/tasks ───────────────────────────────────────

describe('GET /api/projects/:projectId/tasks', () => {
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

  it('200 — returns paginated task list for member', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findMany.mockResolvedValue([{ id: TASK_ID, status: 'PENDING' }])
    db.task.count.mockResolvedValue(1)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/tasks`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(20)
  })

  it('404 — non-member gets 404', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/tasks`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})
