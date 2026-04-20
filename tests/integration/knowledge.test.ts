import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// ── Hoist mock objects so they are available inside vi.mock factories ──────────

const {
  mockPrismaUser,
  mockPrismaProjectMember,
  mockPrismaQueryRawUnsafe,
  mockWithProjectContext,
  mockEmbedText,
  mockApplyRagBudget,
  mockBuildRagPack,
} = vi.hoisted(() => {
  const FAKE_VECTOR = Array.from({ length: 1536 }, (_, i) => i * 0.001)

  return {
    mockPrismaUser: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    mockPrismaProjectMember: {
      findUnique: vi.fn(),
    },
    mockPrismaQueryRawUnsafe: vi.fn(),
    mockWithProjectContext: vi.fn(async (_p: string, _u: string, cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        knowledgeItem: { create: vi.fn().mockResolvedValue({ id: 'new-item' }) },
        execution: {},
        task: {},
        agentOutput: {},
      })
    ),
    mockEmbedText: vi.fn().mockResolvedValue(FAKE_VECTOR),
    mockApplyRagBudget: vi.fn((results: unknown[]) => results),
    mockBuildRagPack: vi.fn(() => ({ shortlist: [], promptPack: '' })),
  }
})

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@ai-marketing/db', () => ({
  prisma: {
    user: mockPrismaUser,
    projectMember: mockPrismaProjectMember,
    $queryRawUnsafe: mockPrismaQueryRawUnsafe,
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
  },
  withProjectContext: mockWithProjectContext,
  Prisma: {},
  PrismaClient: class {},
  MemberRole: {},
  TaskStatus: {},
  ExecutionStatus: {},
  ScenarioType: {},
  AgentType: {},
  KnowledgeCategory: {
    FRAMEWORK: 'FRAMEWORK',
    CASE: 'CASE',
    TEMPLATE: 'TEMPLATE',
    SEO: 'SEO',
    PLATFORM_SPEC: 'PLATFORM_SPEC',
    BRAND_GUIDE: 'BRAND_GUIDE',
  },
}))

vi.mock('@ai-marketing/ai-engine', () => ({
  renderTokenPrometheusMetrics: vi.fn().mockResolvedValue(''),
  embedText: mockEmbedText,
  resolveRagBudget: vi.fn(() => ({ minSimilarity: 0.72, maxCharsPerChunk: 1200, maxTotalChars: 4000 })),
  applyRagBudget: mockApplyRagBudget,
  buildRagPack: mockBuildRagPack,
  runAgent: vi.fn().mockResolvedValue(''),
  TokenLimitExceededError: class TokenLimitExceededError extends Error {},
}))

// Import after mocks are registered
import { buildApp } from '../../apps/api/src/app'
import type { FastifyInstance } from 'fastify'

// ── Constants ─────────────────────────────────────────────────────────────────

const TEST_EMAIL = 'alice@example.com'
const TEST_PASSWORD = 'password123'
const TEST_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const PROJECT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const MOCK_KNOWLEDGE_RESULTS = [
  {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    category: 'FRAMEWORK',
    content: 'Some framework knowledge',
    metadata: {},
    similarity: 0.91,
  },
]

// ── App setup / teardown ──────────────────────────────────────────────────────

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()

  if (!app) {
    app = await buildApp()
    await app.ready()
  }
})

afterAll(async () => {
  if (app) await app.close()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Register a user and return their access token. */
async function getAccessToken(
  email = TEST_EMAIL,
  password = TEST_PASSWORD,
  name = 'Alice'
): Promise<string> {
  mockPrismaUser.findUnique.mockResolvedValueOnce(null)
  mockPrismaUser.create.mockResolvedValueOnce({
    id: TEST_USER_ID,
    email,
    name,
  })

  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, password, name }),
  })

  return res.json().data.tokens.accessToken
}

async function authGet(url: string, token: string, query: Record<string, string | number> = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(query).map(([k, v]) => [k, String(v)]))
  ).toString()
  const fullUrl = qs ? `${url}?${qs}` : url
  const res = await app.inject({
    method: 'GET',
    url: fullUrl,
    headers: { authorization: `Bearer ${token}` },
  })
  return { status: res.statusCode, body: res.json() }
}

const searchUrl = `/api/projects/${PROJECT_ID}/knowledge/search`

// ── GET /api/projects/:projectId/knowledge/search ─────────────────────────────

describe('GET /api/projects/:projectId/knowledge/search', () => {
  it('returns results filtered by project_id when no category is given', async () => {
    const token = await getAccessToken()

    mockPrismaProjectMember.findUnique.mockResolvedValue({
      userId: TEST_USER_ID,
      projectId: PROJECT_ID,
      role: 'MEMBER',
    })
    mockPrismaQueryRawUnsafe.mockResolvedValue(MOCK_KNOWLEDGE_RESULTS)
    mockApplyRagBudget.mockReturnValue(MOCK_KNOWLEDGE_RESULTS)
    mockBuildRagPack.mockReturnValue({ shortlist: ['Some framework knowledge'], promptPack: '---' })

    const { status, body } = await authGet(searchUrl, token, { q: 'content frameworks' })

    expect(status).toBe(200)
    expect(body.data).toEqual(MOCK_KNOWLEDGE_RESULTS)

    // The raw query should NOT contain a category placeholder ($5) — the
    // no-category branch uses a 4-param query.
    const [sql] = mockPrismaQueryRawUnsafe.mock.calls[0]
    expect(sql).not.toMatch(/\$5/)
    expect(sql).toMatch(/project_id = \$2/)
  })

  it('passes category as a bound parameter when a valid category is given', async () => {
    const token = await getAccessToken()

    mockPrismaProjectMember.findUnique.mockResolvedValue({
      userId: TEST_USER_ID,
      projectId: PROJECT_ID,
      role: 'MEMBER',
    })
    mockPrismaQueryRawUnsafe.mockResolvedValue(MOCK_KNOWLEDGE_RESULTS)
    mockApplyRagBudget.mockReturnValue(MOCK_KNOWLEDGE_RESULTS)
    mockBuildRagPack.mockReturnValue({ shortlist: [], promptPack: '' })

    const { status, body } = await authGet(searchUrl, token, {
      q: 'content frameworks',
      category: 'FRAMEWORK',
    })

    expect(status).toBe(200)
    expect(body.data).toEqual(MOCK_KNOWLEDGE_RESULTS)

    // The category-filtered branch uses $5 as a bound parameter.
    const [sql, , , , , categoryArg] = mockPrismaQueryRawUnsafe.mock.calls[0]
    expect(sql).toMatch(/category = \$5/)
    expect(categoryArg).toBe('FRAMEWORK')
  })

  it('returns 400 and never reaches DB when category is a SQL injection string', async () => {
    const token = await getAccessToken()

    const { status } = await authGet(searchUrl, token, {
      q: 'anything',
      category: "X' OR 1=1 --",
    })

    expect(status).toBe(400)
    // Zod rejects the invalid enum value before any DB call
    expect(mockPrismaQueryRawUnsafe).not.toHaveBeenCalled()
    expect(mockEmbedText).not.toHaveBeenCalled()
  })

  it('returns 400 when q is missing', async () => {
    const token = await getAccessToken()

    const { status } = await authGet(searchUrl, token, {})

    expect(status).toBe(400)
    expect(mockPrismaQueryRawUnsafe).not.toHaveBeenCalled()
  })

  it('returns 400 when limit is greater than 20 (Zod .max(20) rejects)', async () => {
    const token = await getAccessToken()

    // KnowledgeSearchSchema: limit: z.coerce.number().int().min(1).max(20)
    // Zod enforces .max(20) as a hard validation error — values above 20 are
    // rejected, not silently clamped to the maximum.
    const { status } = await authGet(searchUrl, token, { q: 'test query', limit: 999 })

    expect(status).toBe(400)
    expect(mockPrismaQueryRawUnsafe).not.toHaveBeenCalled()
  })

  it('returns 401 when no authorization header is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${searchUrl}?q=test`,
    })

    expect(res.statusCode).toBe(401)
    expect(mockPrismaQueryRawUnsafe).not.toHaveBeenCalled()
  })

  it('returns 401 when the token is malformed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${searchUrl}?q=test`,
      headers: { authorization: 'Bearer this.is.not.valid' },
    })

    expect(res.statusCode).toBe(401)
    expect(mockPrismaQueryRawUnsafe).not.toHaveBeenCalled()
  })

  it('returns 404 when the user is not a member of the project', async () => {
    const token = await getAccessToken()

    // Membership lookup returns null — user does not belong to this project.
    mockPrismaProjectMember.findUnique.mockResolvedValue(null)

    const { status } = await authGet(searchUrl, token, { q: 'test query' })

    expect(status).toBe(404)
    expect(mockPrismaQueryRawUnsafe).not.toHaveBeenCalled()
    expect(mockEmbedText).not.toHaveBeenCalled()
  })

  it('forwards the project_id correctly to the raw SQL query', async () => {
    const token = await getAccessToken()

    mockPrismaProjectMember.findUnique.mockResolvedValue({
      userId: TEST_USER_ID,
      projectId: PROJECT_ID,
      role: 'MEMBER',
    })
    mockPrismaQueryRawUnsafe.mockResolvedValue([])
    mockApplyRagBudget.mockReturnValue([])
    mockBuildRagPack.mockReturnValue({ shortlist: [], promptPack: '' })

    await authGet(searchUrl, token, { q: 'test query' })

    const [, , projectIdArg] = mockPrismaQueryRawUnsafe.mock.calls[0]
    expect(projectIdArg).toBe(PROJECT_ID)
  })

  it('embeds the search query and passes the vector to the raw SQL', async () => {
    const FAKE_VECTOR = Array.from({ length: 1536 }, (_, i) => i * 0.001)
    mockEmbedText.mockResolvedValueOnce(FAKE_VECTOR)

    const token = await getAccessToken()

    mockPrismaProjectMember.findUnique.mockResolvedValue({
      userId: TEST_USER_ID,
      projectId: PROJECT_ID,
      role: 'MEMBER',
    })
    mockPrismaQueryRawUnsafe.mockResolvedValue([])
    mockApplyRagBudget.mockReturnValue([])
    mockBuildRagPack.mockReturnValue({ shortlist: [], promptPack: '' })

    await authGet(searchUrl, token, { q: 'marketing strategy' })

    expect(mockEmbedText).toHaveBeenCalledWith('marketing strategy')

    // The first positional arg is the serialized vector string.
    const [, vectorParam] = mockPrismaQueryRawUnsafe.mock.calls[0]
    expect(vectorParam).toBe(`[${FAKE_VECTOR.join(',')}]`)
  })

  it('returns shortlist and promptPack from buildRagPack in the response', async () => {
    const token = await getAccessToken()

    mockPrismaProjectMember.findUnique.mockResolvedValue({
      userId: TEST_USER_ID,
      projectId: PROJECT_ID,
      role: 'MEMBER',
    })
    mockPrismaQueryRawUnsafe.mockResolvedValue(MOCK_KNOWLEDGE_RESULTS)
    mockApplyRagBudget.mockReturnValue(MOCK_KNOWLEDGE_RESULTS)
    mockBuildRagPack.mockReturnValue({
      shortlist: ['chunk one', 'chunk two'],
      promptPack: 'packed context',
    })

    const { status, body } = await authGet(searchUrl, token, { q: 'test' })

    expect(status).toBe(200)
    expect(body.shortlist).toEqual(['chunk one', 'chunk two'])
    expect(body.promptPack).toBe('packed context')
  })
})
