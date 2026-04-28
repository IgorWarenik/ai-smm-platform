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
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    projectProfile: { findUnique: vi.fn() },
    execution: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    agentOutput: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    approval: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    agentFeedback: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    conversation: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    file: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
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

const PROJECT_ID = 'a0000000-0000-0000-0000-000000000001'
const TASK_ID = 'b0000000-0000-0000-0000-000000000002'
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
    mockScoreTask.mockImplementation(() => new Promise(() => {}))
    mockWPC.mockImplementation(async (_pid: string, _uid: string, cb: any) => cb(db))
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('201 — creates QUEUED task before background scoring', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.projectProfile.findUnique.mockResolvedValue({ projectId: PROJECT_ID })
    db.task.create.mockResolvedValue({
      id: TASK_ID,
      projectId: PROJECT_ID,
      input: 'Create a comprehensive content strategy for Q1',
      score: 0,
      scenario: null,
      status: 'QUEUED',
      createdAt: new Date(),
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: 'Create a comprehensive content strategy for Q1' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().data.status).toBe('QUEUED')
  })

  it('201 — does not wait for clarification scoring', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.projectProfile.findUnique.mockResolvedValue({ projectId: PROJECT_ID })
    db.task.create.mockResolvedValue({
      id: TASK_ID,
      projectId: PROJECT_ID,
      input: 'Do marketing stuff',
      score: 0,
      status: 'QUEUED',
      createdAt: new Date(),
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: 'Do marketing stuff for the company' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.status).toBe('QUEUED')
    expect(body.clarificationQuestions).toBeUndefined()
  })

  it('201 — does not wait for rejection scoring', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.projectProfile.findUnique.mockResolvedValue({ projectId: PROJECT_ID })
    db.task.create.mockResolvedValue({
      id: TASK_ID,
      projectId: PROJECT_ID,
      input: 'Do stuff',
      score: 0,
      status: 'QUEUED',
      createdAt: new Date(),
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: 'Do stuff for the company campaign' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().data.status).toBe('QUEUED')
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

  it('422 — create task requires project profile before sending to agents', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.projectProfile.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: 'Create a comprehensive content strategy for Q1' },
    })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toMatchObject({
      error: 'Project profile is required before executing tasks',
      code: 'PROFILE_MISSING',
    })
    expect(db.task.create).not.toHaveBeenCalled()
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

  it('200 — provides answer, rescore can keep task awaiting clarification', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findFirst.mockResolvedValue({
      id: TASK_ID,
      projectId: PROJECT_ID,
      input: 'Do marketing',
      status: 'AWAITING_CLARIFICATION',
    })
    mockScoreTask.mockResolvedValue({
      score: 30,
      scenario: 'A',
      reasoning: 'Still needs details',
      isValid: true,
      clarificationQuestions: ['What channel should this target?'],
    })
    db.task.update.mockResolvedValue({
      id: TASK_ID,
      input: 'Do marketing\n\nКлиент уточнил:\nTarget: SMB companies in Russia',
      score: 30,
      status: 'AWAITING_CLARIFICATION',
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/clarify`,
      headers: { authorization: `Bearer ${token}` },
      payload: { answer: 'Target: SMB companies in Russia' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.status).toBe('AWAITING_CLARIFICATION')
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

  it('200 — filters tasks by status', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findMany.mockResolvedValue([{ id: TASK_ID, status: 'AWAITING_APPROVAL' }])
    db.task.count.mockResolvedValue(1)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/tasks?status=AWAITING_APPROVAL`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId: PROJECT_ID, status: 'AWAITING_APPROVAL' },
      })
    )
    expect(db.task.count).toHaveBeenCalledWith({
      where: { projectId: PROJECT_ID, status: 'AWAITING_APPROVAL' },
    })
  })
})

// ─── DELETE /api/projects/:projectId/tasks/:taskId ───────────────────────────

describe('DELETE /api/projects/:projectId/tasks/:taskId', () => {
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

  it('204 — member deletes own task', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findUnique.mockResolvedValue({ id: TASK_ID, projectId: PROJECT_ID })
    db.execution.findMany.mockResolvedValue([])
    db.task.delete.mockResolvedValue({})

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(204)
  })

  it('204 — deletes task with executions and dependent rows', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findUnique.mockResolvedValue({ id: TASK_ID, projectId: PROJECT_ID })
    db.execution.findMany.mockResolvedValue([{ id: 'exec-1' }, { id: 'exec-2' }])
    db.task.delete.mockResolvedValue({})

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(204)
    expect(db.agentOutput.deleteMany).toHaveBeenCalledWith({
      where: { executionId: { in: ['exec-1', 'exec-2'] } },
    })
    expect(db.execution.deleteMany).toHaveBeenCalledWith({ where: { taskId: TASK_ID } })
    expect(db.approval.deleteMany).toHaveBeenCalledWith({ where: { taskId: TASK_ID } })
    expect(db.agentFeedback.deleteMany).toHaveBeenCalledWith({ where: { taskId: TASK_ID } })
    expect(db.conversation.deleteMany).toHaveBeenCalledWith({ where: { taskId: TASK_ID } })
    expect(db.file.deleteMany).toHaveBeenCalledWith({ where: { taskId: TASK_ID } })
    expect(db.task.delete).toHaveBeenCalledWith({ where: { id: TASK_ID } })
  })

  it('404 — non-member cannot delete', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })

  it('404 — task not found', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ─── PATCH /api/projects/:projectId/tasks/:taskId ───────────────────────────

describe('PATCH /api/projects/:projectId/tasks/:taskId', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('200 — updates input on PENDING task', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findUnique.mockResolvedValue({ id: TASK_ID, projectId: PROJECT_ID, status: 'PENDING', input: 'old' })
    db.task.update.mockResolvedValue({ id: TASK_ID, projectId: PROJECT_ID, status: 'PENDING', input: 'new input' })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: 'new input' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.input).toBe('new input')
  })

  it('200 — updates input on REJECTED task', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findUnique.mockResolvedValue({ id: TASK_ID, projectId: PROJECT_ID, status: 'REJECTED', input: 'old' })
    db.task.update.mockResolvedValue({ id: TASK_ID, projectId: PROJECT_ID, status: 'REJECTED', input: 'revised input' })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: 'revised input' },
    })

    expect(res.statusCode).toBe(200)
  })

  it('400 — cannot edit task in RUNNING status', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findUnique.mockResolvedValue({ id: TASK_ID, projectId: PROJECT_ID, status: 'RUNNING', input: 'old' })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: 'new input' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('404 — non-member cannot edit task', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { input: 'new input' },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ─── UUID validation ─────────────────────────────────────────────────────────

describe('UUID validation', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('400 — invalid projectId returns bad request', async () => {
    const token = await getToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/not-a-uuid',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 — GET task list rejects invalid projectId', async () => {
    const token = await getToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/not-a-uuid/tasks',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })
})
