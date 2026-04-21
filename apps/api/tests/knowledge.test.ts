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
    knowledgeItem: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn(),
  },
  withProjectContext: vi.fn(),
}))

vi.mock('@ai-marketing/ai-engine', () => ({
  renderTokenPrometheusMetrics: vi.fn().mockResolvedValue(''),
  embedText: vi.fn().mockResolvedValue(new Array(1024).fill(0.1)),
  applyRagBudget: vi.fn().mockImplementation((results: any[]) => results),
  buildRagPack: vi.fn().mockReturnValue({ shortlist: [], promptPack: '' }),
  resolveRagBudget: vi.fn().mockReturnValue({ maxCharsPerChunk: 1200, maxTotalChars: 4000, minSimilarity: 0.72 }),
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

async function getToken(app: FastifyInstance): Promise<string> {
  db.user.findUnique.mockResolvedValueOnce({
    id: USER_ID,
    email: 'kb@example.com',
    name: 'KB Admin',
    passwordHash: 'hashed_pw',
  })
  db.refreshToken.create.mockResolvedValue({})
  mockBcrypt.compare.mockResolvedValueOnce(true)

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: 'kb@example.com', password: 'password123' },
  })
  return res.json().data.tokens.accessToken
}

// ─── POST /api/projects/:projectId/knowledge ──────────────────────────────────

describe('POST /api/projects/:projectId/knowledge', () => {
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

  it('201 — creates knowledge item with valid category', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.knowledgeItem.create.mockResolvedValue({
      id: 'item-1',
      projectId: PROJECT_ID,
      category: 'BRAND_GUIDE',
      content: 'Our brand voice is professional but accessible.',
      metadata: { title: 'Brand Tone of Voice' },
    })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/knowledge`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        category: 'BRAND_GUIDE',
        content: 'Our brand voice is professional but accessible.',
        metadata: { title: 'Brand Tone of Voice' },
      },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.category).toBe('BRAND_GUIDE')
    expect(body.data.content).toBeDefined()
  })

  it('400 — invalid category value', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/knowledge`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        category: 'INVALID_CATEGORY',
        content: 'Some content for the knowledge base.',
      },
    })

    expect(res.statusCode).toBe(400)
  })

  it('404 — non-member cannot create knowledge item', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: `/api/projects/${PROJECT_ID}/knowledge`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        category: 'FRAMEWORK',
        content: 'Content for framework knowledge.',
      },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ─── GET /api/projects/:projectId/knowledge ───────────────────────────────────

describe('GET /api/projects/:projectId/knowledge', () => {
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

  it('200 — returns knowledge items for member', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.knowledgeItem.findMany.mockResolvedValue([
      { id: 'item-1', category: 'TEMPLATE', content: 'Email template 1' },
      { id: 'item-2', category: 'SEO', content: 'SEO guidelines' },
    ])

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/knowledge`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(2)
  })

  it('404 — non-member gets 404', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/knowledge`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ─── GET /api/projects/:projectId/knowledge/search ───────────────────────────

describe('GET /api/projects/:projectId/knowledge/search', () => {
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

  it('200 — semantic search returns results array', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.$queryRawUnsafe.mockResolvedValue([
      { id: 'item-1', category: 'TEMPLATE', content: 'Email template 1', metadata: {}, similarity: 0.9 },
    ])

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/knowledge/search?q=email+templates`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().data)).toBe(true)
  })

  it('200 — returns empty array when no results match', async () => {
    const token = await getToken(app)

    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.$queryRawUnsafe.mockResolvedValue([])

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/knowledge/search?q=nonexistent+topic`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(0)
  })

  it('400 — missing required q parameter', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/knowledge/search`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(400)
  })

  it('404 — non-member gets 404', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/knowledge/search?q=brand`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ─── DELETE /api/projects/:projectId/knowledge/:itemId ───────────────────────

describe('DELETE /api/projects/:projectId/knowledge/:itemId', () => {
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

  it('204 — member deletes existing item', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.knowledgeItem.findUnique.mockResolvedValue({
      id: 'item-1',
      projectId: PROJECT_ID,
    })
    db.knowledgeItem.delete.mockResolvedValue({})

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/knowledge/item-1`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(204)
  })

  it('404 — item not found', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.knowledgeItem.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/knowledge/nonexistent`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })

  it('404 — non-member cannot delete', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/knowledge/item-1`,
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ─── PATCH /api/projects/:projectId/knowledge/:itemId ────────────────────────

describe('PATCH /api/projects/:projectId/knowledge/:itemId', () => {
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

  it('200 — updates content', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.knowledgeItem.findUnique.mockResolvedValue({ id: 'item-1', projectId: PROJECT_ID })
    db.knowledgeItem.update.mockResolvedValue({
      id: 'item-1',
      projectId: PROJECT_ID,
      content: 'Updated content',
      category: 'TEMPLATE',
    })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/knowledge/item-1`,
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'Updated content' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().data.content).toBe('Updated content')
  })

  it('400 — empty body rejected', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/knowledge/item-1`,
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })

  it('404 — non-member cannot patch', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/knowledge/item-1`,
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'Updated' },
    })

    expect(res.statusCode).toBe(404)
  })

  it('404 — item not found', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.knowledgeItem.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/projects/${PROJECT_ID}/knowledge/item-1`,
      headers: { authorization: `Bearer ${token}` },
      payload: { content: 'Updated' },
    })

    expect(res.statusCode).toBe(404)
  })
})
