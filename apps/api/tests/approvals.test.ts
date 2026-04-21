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
    task: { findFirst: vi.fn(), update: vi.fn() },
    approval: {
      create: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
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

import { buildApp } from '../src/app'
import { prisma, withProjectContext } from '@ai-marketing/db'
import bcrypt from 'bcryptjs'

const db = prisma as any
const mockBcrypt = bcrypt as any
const mockWPC = withProjectContext as any

const PROJECT_ID = 'proj-00000000-0000-0000-0000-000000000001'
const TASK_ID = 'task-0000-0000-0000-0000-000000000001'
const USER_ID = 'user-0000-0000-0000-0000-000000000001'

async function getToken(app: FastifyInstance): Promise<string> {
  db.user.findUnique.mockResolvedValueOnce({
    id: USER_ID,
    email: 'approver@example.com',
    name: 'Approver',
    passwordHash: 'hashed_pw',
  })
  db.refreshToken.create.mockResolvedValue({})
  mockBcrypt.compare.mockResolvedValueOnce(true)

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'approver@example.com', password: 'password123' },
  })
  return res.json().data.tokens.accessToken
}

// ─── GET /api/projects/:projectId/tasks/:taskId/approvals ─────────────────────

describe('GET /api/projects/:projectId/tasks/:taskId/approvals', () => {
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

  it('200 — returns paginated approvals list', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })
    db.task.findFirst.mockResolvedValue({ id: TASK_ID, status: 'AWAITING_APPROVAL' })
    db.approval.findMany.mockResolvedValue([{ id: 'appr-1', decision: 'APPROVED' }])
    db.approval.count.mockResolvedValue(1)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/approvals`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.total).toBe(1)
  })

  it('404 — non-member gets 404', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/approvals`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ─── POST /api/projects/:projectId/tasks/:taskId/approvals ────────────────────

describe('POST /api/projects/:projectId/tasks/:taskId/approvals', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops(db)
    )
    mockWPC.mockImplementation(async (_pid: string, _uid: string, cb: any) => cb(db))
    db.approval.count.mockResolvedValue(0)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('201 — APPROVED moves task to COMPLETED', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })
    db.task.findFirst.mockResolvedValue({ id: TASK_ID, status: 'AWAITING_APPROVAL' })
    db.approval.create.mockResolvedValue({ id: 'appr-1', decision: 'APPROVED', iteration: 1 })
    db.task.update.mockResolvedValue({ id: TASK_ID, status: 'COMPLETED' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/approvals`,
      headers: { authorization: `Bearer ${token}` },
      payload: { decision: 'APPROVED', comment: 'Looks great!' },
    })

    expect(res.statusCode).toBe(201)
    const taskUpdate = db.task.update.mock.calls[0][0]
    expect(taskUpdate.data.status).toBe('COMPLETED')
  })

  it('201 — REJECTED moves task to REJECTED', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })
    db.task.findFirst.mockResolvedValue({ id: TASK_ID, status: 'AWAITING_APPROVAL' })
    db.approval.create.mockResolvedValue({ id: 'appr-1', decision: 'REJECTED', iteration: 1 })
    db.task.update.mockResolvedValue({ id: TASK_ID, status: 'REJECTED' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/approvals`,
      headers: { authorization: `Bearer ${token}` },
      payload: { decision: 'REJECTED', comment: 'Not good enough' },
    })

    expect(res.statusCode).toBe(201)
    const taskUpdate = db.task.update.mock.calls[0][0]
    expect(taskUpdate.data.status).toBe('REJECTED')
  })

  it('201 — REVISION_REQUESTED moves task to QUEUED (iteration 1)', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })
    db.task.findFirst.mockResolvedValue({ id: TASK_ID, status: 'AWAITING_APPROVAL' })
    db.approval.count.mockResolvedValue(0)
    db.approval.create.mockResolvedValue({ id: 'appr-1', decision: 'REVISION_REQUESTED', iteration: 1 })
    db.task.update.mockResolvedValue({ id: TASK_ID, status: 'QUEUED' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/approvals`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        decision: 'REVISION_REQUESTED',
        comment: 'Please revise the tone, structure, and call to action with clearer guidance.',
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.meta.managerEscalated).toBe(false)
    const taskUpdate = db.task.update.mock.calls[0][0]
    expect(taskUpdate.data.status).toBe('QUEUED')
  })

  it('201 — REVISION_REQUESTED at max revisions escalates to manager', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })
    db.task.findFirst.mockResolvedValue({ id: TASK_ID, status: 'AWAITING_APPROVAL' })
    db.approval.count.mockResolvedValue(3) // >= APPROVAL_MAX_REVISIONS (3)
    db.approval.create.mockResolvedValue({ id: 'appr-4', decision: 'REVISION_REQUESTED', iteration: 4 })
    db.task.update.mockResolvedValue({ id: TASK_ID, status: 'AWAITING_APPROVAL', requiresReview: true })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/approvals`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        decision: 'REVISION_REQUESTED',
        comment: 'Still not good enough; revise the structure, tone, and final CTA with specifics.',
      },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().meta.managerEscalated).toBe(true)
    const taskUpdate = db.task.update.mock.calls[0][0]
    expect(taskUpdate.data.requiresReview).toBe(true)
  })

  it('400 — task not AWAITING_APPROVAL', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })
    db.task.findFirst.mockResolvedValue({ id: TASK_ID, status: 'PENDING' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/approvals`,
      headers: { authorization: `Bearer ${token}` },
      payload: { decision: 'APPROVED' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('404 — non-member gets 404', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/approvals`,
      headers: { authorization: `Bearer ${token}` },
      payload: { decision: 'APPROVED' },
    })

    expect(res.statusCode).toBe(404)
  })
})
