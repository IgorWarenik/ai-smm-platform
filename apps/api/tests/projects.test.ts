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
    projectMember: { findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn(), count: vi.fn() },
    project: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
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

const PROJECT_ID = 'a0000000-0000-0000-0000-000000000001'
const USER_ID = 'user-0000-0000-0000-0000-000000000001'
const TARGET_USER_ID = 'user-0000-0000-0000-0000-000000000002'

async function getToken(app: FastifyInstance): Promise<string> {
  db.user.findUnique.mockResolvedValueOnce({
    id: USER_ID,
    email: 'owner@example.com',
    name: 'Owner',
    passwordHash: 'hashed_pw',
  })
  db.refreshToken.create.mockResolvedValue({})
  mockBcrypt.compare.mockResolvedValueOnce(true)

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'owner@example.com', password: 'password123' },
  })
  return res.json().data.tokens.accessToken
}

// ─── POST /api/projects ───────────────────────────────────────────────────────

describe('POST /api/projects', () => {
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

  it('201 — creates project and returns data', async () => {
    const token = await getToken(app)

    db.project.create.mockResolvedValue({
      id: PROJECT_ID,
      name: 'My Marketing Campaign',
      ownerId: USER_ID,
      settings: {},
      createdAt: new Date(),
    })

    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'My Marketing Campaign' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().data.name).toBe('My Marketing Campaign')
  })

  it('400 — missing name', async () => {
    const token = await getToken(app)

    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })

  it('401 — unauthenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Test' },
    })
    expect(res.statusCode).toBe(401)
  })
})

// ─── GET /api/projects ────────────────────────────────────────────────────────

describe('GET /api/projects', () => {
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

  it('200 — returns paginated projects for user', async () => {
    const token = await getToken(app)

    db.project.findMany.mockResolvedValue([{ id: PROJECT_ID, name: 'Campaign A' }])
    db.project.count.mockResolvedValue(1)

    const res = await app.inject({
      method: 'GET',
      url: '/api/projects',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body.data)).toBe(true)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
  })
})

// ─── GET /api/projects/:projectId ────────────────────────────────────────────

describe('GET /api/projects/:projectId', () => {
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

  it('200 — member gets project details', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })
    db.project.findUnique.mockResolvedValue({ id: PROJECT_ID, name: 'Campaign A' })

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.id).toBe(PROJECT_ID)
  })

  it('404 — non-member gets 404', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })

  it('400 — invalid projectId returns bad request', async () => {
    const token = await getToken(app)

    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/not-a-uuid',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().message).toBe('projectId must be a valid UUID')
  })
})

// ─── PATCH /api/projects/:projectId ──────────────────────────────────────────

describe('PATCH /api/projects/:projectId', () => {
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

  it('200 — owner can update project name', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })
    db.project.update.mockResolvedValue({ id: PROJECT_ID, name: 'New Campaign Name' })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'New Campaign Name' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.name).toBe('New Campaign Name')
  })

  it('403 — VIEWER cannot update project', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'VIEWER' })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Attempted Update' },
    })

    expect(res.statusCode).toBe(403)
  })

  it('404 — non-member gets 404', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Update' },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ─── DELETE /api/projects/:projectId ─────────────────────────────────────────

describe('DELETE /api/projects/:projectId', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('204 — owner can delete project', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(204)
  })

  it('403 — MEMBER cannot delete project', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(403)
  })

  it('404 — non-member gets 404', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ─── POST /api/projects/:projectId/members ────────────────────────────────────

describe('POST /api/projects/:projectId/members', () => {
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

  it('201 — owner adds a new member', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique
      .mockResolvedValueOnce({ role: 'OWNER' }) // caller membership check
      .mockResolvedValueOnce(null) // target not already a member
    db.user.findUnique.mockResolvedValue({ id: TARGET_USER_ID, email: 'newmember@example.com' })
    db.projectMember.upsert.mockResolvedValue({ userId: TARGET_USER_ID, projectId: PROJECT_ID, role: 'MEMBER' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'newmember@example.com', role: 'MEMBER' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().data.role).toBe('MEMBER')
  })

  it('403 — MEMBER cannot grant OWNER role', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValueOnce({ role: 'MEMBER' }) // caller is MEMBER
    db.user.findUnique.mockResolvedValue({ id: TARGET_USER_ID, email: 'target@example.com' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'target@example.com', role: 'OWNER' },
    })

    expect(res.statusCode).toBe(403)
  })

  it('422 — cannot demote the last OWNER', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique
      .mockResolvedValueOnce({ role: 'OWNER' }) // caller is OWNER
      .mockResolvedValueOnce({ role: 'OWNER' }) // target is OWNER
    db.projectMember.count.mockResolvedValue(1) // only 1 owner
    db.user.findUnique.mockResolvedValue({ id: TARGET_USER_ID, email: 'lastowner@example.com' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'lastowner@example.com', role: 'MEMBER' },
    })

    expect(res.statusCode).toBe(422)
  })

  it('404 — target user not found', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValueOnce({ role: 'OWNER' })
    db.user.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/members`,
      headers: { authorization: `Bearer ${token}` },
      payload: { email: 'nobody@example.com', role: 'MEMBER' },
    })

    expect(res.statusCode).toBe(404)
  })
})
