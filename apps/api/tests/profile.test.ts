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
    projectProfile: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
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
const USER_ID = 'user-0000-0000-0000-0000-000000000001'

const VALID_PROFILE = {
  companyName: 'Acme Corp',
  description: 'A leading provider of AI marketing solutions for SMBs',
  niche: 'AI Marketing',
  geography: 'Russia',
}

const STORED_PROFILE = {
  ...VALID_PROFILE,
  id: 'profile-1',
  projectId: PROJECT_ID,
  products: [],
  audience: [],
  competitors: [],
  tov: 'FRIENDLY',
  keywords: [],
  forbidden: [],
  createdAt: new Date(),
  updatedAt: new Date(),
}

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

// ─── GET /api/projects/:projectId/profile ────────────────────────────────────

describe('GET /api/projects/:projectId/profile', () => {
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

  it('200 — member gets profile', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.projectProfile.findUnique.mockResolvedValue(STORED_PROFILE)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/profile`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.companyName).toBe('Acme Corp')
  })

  it('404 — profile not yet created', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.projectProfile.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/profile`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })

  it('404 — non-member gets 404', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/profile`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ─── PUT /api/projects/:projectId/profile ────────────────────────────────────

describe('PUT /api/projects/:projectId/profile', () => {
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

  it('200 — owner creates/replaces profile', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })
    db.projectProfile.upsert.mockResolvedValue(STORED_PROFILE)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/projects/${PROJECT_ID}/profile`,
      headers: { authorization: `Bearer ${token}` },
      payload: VALID_PROFILE,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.companyName).toBe('Acme Corp')
  })

  it('403 — VIEWER cannot set profile', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'VIEWER' })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/projects/${PROJECT_ID}/profile`,
      headers: { authorization: `Bearer ${token}` },
      payload: VALID_PROFILE,
    })

    expect(res.statusCode).toBe(403)
  })

  it('404 — non-member gets 404', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PUT',
      url: `/api/projects/${PROJECT_ID}/profile`,
      headers: { authorization: `Bearer ${token}` },
      payload: VALID_PROFILE,
    })

    expect(res.statusCode).toBe(404)
  })

  it('400 — missing required fields', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })

    const res = await app.inject({
      method: 'PUT',
      url: `/api/projects/${PROJECT_ID}/profile`,
      headers: { authorization: `Bearer ${token}` },
      payload: { companyName: 'Missing required description' },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ─── PATCH /api/projects/:projectId/profile ───────────────────────────────────

describe('PATCH /api/projects/:projectId/profile', () => {
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

  it('200 — owner patches profile fields', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })
    db.projectProfile.findUnique.mockResolvedValue(STORED_PROFILE)
    db.projectProfile.update.mockResolvedValue({ ...STORED_PROFILE, niche: 'B2B SaaS' })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/profile`,
      headers: { authorization: `Bearer ${token}` },
      payload: { niche: 'B2B SaaS' },
    })

    expect(res.statusCode).toBe(200)
  })

  it('404 — patch on non-existent profile', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'OWNER' })
    db.projectProfile.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/profile`,
      headers: { authorization: `Bearer ${token}` },
      payload: { niche: 'B2B SaaS' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('403 — VIEWER cannot patch profile', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'VIEWER' })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/profile`,
      headers: { authorization: `Bearer ${token}` },
      payload: { niche: 'B2B SaaS' },
    })

    expect(res.statusCode).toBe(403)
  })
})
