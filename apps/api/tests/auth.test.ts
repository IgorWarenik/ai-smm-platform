import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import type { FastifyInstance } from 'fastify'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-minimum-32-chars!!'
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars!!!!'
  process.env.INTERNAL_API_TOKEN = 'test-internal-token'
})

vi.mock('@ai-marketing/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}))

vi.mock('@ai-marketing/ai-engine', () => ({
  renderTokenPrometheusMetrics: vi.fn().mockResolvedValue(''),
}))

import { buildApp } from '../src/app'
import { prisma } from '@ai-marketing/db'
import bcrypt from 'bcryptjs'

const db = prisma as any
const mockBcrypt = bcrypt as any

// ─── Register ─────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('201 — creates user, returns tokens and user data', async () => {
    db.user.findUnique.mockResolvedValue(null)
    mockBcrypt.hash.mockResolvedValue('hashed_pw')
    db.user.create.mockResolvedValue({ id: 'user-1', email: 'owner@example.com', name: 'Owner' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'owner@example.com', password: 'password123', name: 'Owner' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.data.user.email).toBe('owner@example.com')
    expect(body.data.tokens.accessToken).toBeDefined()
    expect(body.data.tokens.refreshToken).toBeDefined()
  })

  it('201 — name is optional', async () => {
    db.user.findUnique.mockResolvedValue(null)
    mockBcrypt.hash.mockResolvedValue('hashed_pw')
    db.user.create.mockResolvedValue({ id: 'user-2', email: 'anon@example.com', name: null })

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'anon@example.com', password: 'password123' },
    })

    expect(res.statusCode).toBe(201)
  })

  it('409 — email already in use', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'existing' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'owner@example.com', password: 'password123' },
    })

    expect(res.statusCode).toBe(409)
  })

  it('400 — invalid email format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'not-an-email', password: 'password123' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('400 — password too short (< 8 chars)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'owner@example.com', password: 'short' },
    })

    expect(res.statusCode).toBe(400)
  })
})

// ─── Login ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('200 — valid credentials return tokens and user', async () => {
    db.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner',
      passwordHash: 'hashed_pw',
    })
    mockBcrypt.compare.mockResolvedValue(true)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'owner@example.com', password: 'password123' },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.tokens.accessToken).toBeDefined()
    expect(body.data.tokens.refreshToken).toBeDefined()
    expect(body.data.user.email).toBe('owner@example.com')
  })

  it('401 — user not found', async () => {
    db.user.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'nobody@example.com', password: 'password123' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('401 — wrong password', async () => {
    db.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      passwordHash: 'hashed_pw',
    })
    mockBcrypt.compare.mockResolvedValue(false)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'owner@example.com', password: 'wrongpassword' },
    })

    expect(res.statusCode).toBe(401)
  })
})

// ─── Refresh ──────────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  async function loginAndGetTokens(instance: FastifyInstance) {
    db.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner',
      passwordHash: 'hashed_pw',
    })
    mockBcrypt.compare.mockResolvedValue(true)

    const res = await instance.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'owner@example.com', password: 'password123' },
    })
    return res.json().data.tokens as { accessToken: string; refreshToken: string }
  }

  it('200 — valid refresh token issues new token pair', async () => {
    const { refreshToken } = await loginAndGetTokens(app)

    db.refreshToken.findUnique.mockResolvedValue({
      token: refreshToken,
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    })
    db.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'owner@example.com', name: 'Owner' })

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.tokens.accessToken).toBeDefined()
    expect(body.data.tokens.refreshToken).toBeDefined()
  })

  it('401 — access token rejected as refresh token', async () => {
    const { accessToken } = await loginAndGetTokens(app)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: accessToken },
    })

    expect(res.statusCode).toBe(401)
  })

  it('401 — malformed token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'not.a.valid.token' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('401 — user deleted after token issued', async () => {
    const { refreshToken } = await loginAndGetTokens(app)

    db.user.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    })

    expect(res.statusCode).toBe(401)
  })
})

// ─── Me ───────────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  async function getAccessToken(instance: FastifyInstance): Promise<string> {
    db.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner',
      passwordHash: 'hashed_pw',
    })
    mockBcrypt.compare.mockResolvedValue(true)

    const res = await instance.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'owner@example.com', password: 'password123' },
    })
    return res.json().data.tokens.accessToken
  }

  it('200 — authenticated user gets profile', async () => {
    const token = await getAccessToken(app)

    db.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner',
      createdAt: new Date('2026-01-01'),
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data.email).toBe('owner@example.com')
    expect(body.data.id).toBe('user-1')
  })

  it('401 — no token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
    })

    expect(res.statusCode).toBe(401)
  })

  it('401 — refresh token rejected for API access', async () => {
    db.user.findUnique.mockResolvedValueOnce({
      id: 'user-1',
      email: 'owner@example.com',
      passwordHash: 'hashed_pw',
    })
    mockBcrypt.compare.mockResolvedValue(true)

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'owner@example.com', password: 'password123' },
    })
    const { refreshToken } = loginRes.json().data.tokens

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${refreshToken}` },
    })

    expect(res.statusCode).toBe(401)
  })

  it('404 — user deleted after token issued', async () => {
    const token = await getAccessToken(app)

    db.user.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(404)
  })
})
