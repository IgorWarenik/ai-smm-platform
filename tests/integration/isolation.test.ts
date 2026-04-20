import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// ── Hoist mock objects ────────────────────────────────────────────────────────

const {
  mockPrismaProjectMember,
  mockPrismaTask,
  mockPrismaKnowledgeItem,
  mockPrismaTransaction,
} = vi.hoisted(() => {
  const mockPrismaTransaction = {
    task: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    execution: {
      create: vi.fn(),
    },
    projectProfile: {
      findUnique: vi.fn(),
    },
    knowledgeItem: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $executeRaw: vi.fn().mockResolvedValue(0),
  }

  return {
    mockPrismaProjectMember: { findUnique: vi.fn() },
    mockPrismaTask: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    mockPrismaKnowledgeItem: {
      findMany: vi.fn(),
    },
    mockPrismaTransaction,
  }
})

const { mockScoreTask } = vi.hoisted(() => ({
  mockScoreTask: vi.fn(),
}))

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@ai-marketing/db', () => ({
  prisma: {
    projectMember: mockPrismaProjectMember,
    task: mockPrismaTask,
    knowledgeItem: mockPrismaKnowledgeItem,
    $transaction: vi.fn(async (fn: (tx: typeof mockPrismaTransaction) => Promise<unknown>) =>
      fn(mockPrismaTransaction)
    ),
  },
  withProjectContext: vi.fn(
    async (
      _projectId: string,
      _userId: string,
      fn: (tx: typeof mockPrismaTransaction) => Promise<unknown>
    ) => fn(mockPrismaTransaction)
  ),
  Prisma: {},
  PrismaClient: class {},
  MemberRole: {},
  TaskStatus: {},
  ScenarioType: {},
  ExecutionStatus: {},
  AgentType: {},
  KnowledgeCategory: {},
}))

vi.mock('@ai-marketing/ai-engine', () => ({
  renderTokenPrometheusMetrics: vi.fn().mockResolvedValue(''),
  embedText: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  applyRagBudget: vi.fn().mockReturnValue([]),
  buildRagPack: vi.fn().mockReturnValue({ shortlist: [], promptPack: '' }),
  resolveRagBudget: vi.fn().mockReturnValue({ minSimilarity: 0.7, maxCharsPerChunk: 1000, maxTotalChars: 5000 }),
}))

vi.mock('../../apps/api/src/services/scoring', () => ({
  scoreTask: mockScoreTask,
}))

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { buildApp } from '../../apps/api/src/app'
import type { FastifyInstance } from 'fastify'
import { TaskStatus, ScenarioType } from '@ai-marketing/shared'

// ── Test fixtures ─────────────────────────────────────────────────────────────

// Tenant A
const PROJECT_A_ID = 'project-aaaa-0001'
const USER_A_ID = 'user-aaaa-0001'
const USER_A_EMAIL = 'alice@tenant-a.com'
const TASK_A_ID = 'task-aaaa-0001'

// Tenant B
const PROJECT_B_ID = 'project-bbbb-0002'
const USER_B_ID = 'user-bbbb-0002'
const USER_B_EMAIL = 'bob@tenant-b.com'
const TASK_B_ID = 'task-bbbb-0002'

// User with no membership at all
const NO_MEMBER_USER_ID = 'user-nomember-9999'
const NO_MEMBER_USER_EMAIL = 'nobody@orphan.com'

const VALID_INPUT = 'Create a social media campaign for our new product launch targeting millennials.'

let app: FastifyInstance

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTokenFor(userId: string, email: string) {
  return app.jwt.sign({ sub: userId, email, type: 'access' }, { expiresIn: '15m' })
}

async function authGet(url: string, token: string) {
  const res = await app.inject({
    method: 'GET',
    url,
    headers: { authorization: `Bearer ${token}` },
  })
  return { status: res.statusCode, body: res.json() }
}

async function authPost(url: string, body: unknown, token: string) {
  const res = await app.inject({
    method: 'POST',
    url,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    payload: JSON.stringify(body),
  })
  return { status: res.statusCode, body: res.json() }
}

function makeTask(projectId: string, taskId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: taskId,
    projectId,
    input: VALID_INPUT,
    score: 75,
    status: TaskStatus.PENDING,
    scenario: ScenarioType.B,
    clarificationNote: null,
    rejectedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    executions: [],
    ...overrides,
  }
}

function makeKnowledgeItem(projectId: string) {
  return {
    id: `ki-${projectId}`,
    projectId,
    category: 'TEMPLATE',
    content: 'Sample knowledge content',
    metadata: {},
    createdAt: new Date(),
  }
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

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

// ── Cross-Tenant Isolation Tests ──────────────────────────────────────────────

describe('Cross-tenant isolation — tasks', () => {
  it('user of project A cannot read tasks of project B (returns 404)', async () => {
    // User A is a member of project A only — project B membership returns null
    mockPrismaProjectMember.findUnique.mockImplementation(
      ({ where }: { where: { userId_projectId: { userId: string; projectId: string } } }) => {
        const { userId, projectId } = where.userId_projectId
        if (userId === USER_A_ID && projectId === PROJECT_A_ID) {
          return Promise.resolve({ userId: USER_A_ID, projectId: PROJECT_A_ID, role: 'MEMBER' })
        }
        return Promise.resolve(null)
      }
    )

    const tokenA = makeTokenFor(USER_A_ID, USER_A_EMAIL)

    // User A tries to read tasks that belong to Project B
    const { status } = await authGet(
      `/api/projects/${PROJECT_B_ID}/tasks/${TASK_B_ID}`,
      tokenA
    )

    expect([403, 404]).toContain(status)
  })

  it('user of project A cannot list tasks of project B (returns 404)', async () => {
    mockPrismaProjectMember.findUnique.mockResolvedValue(null)

    const tokenA = makeTokenFor(USER_A_ID, USER_A_EMAIL)
    const { status } = await authGet(`/api/projects/${PROJECT_B_ID}/tasks`, tokenA)

    expect([403, 404]).toContain(status)
  })

  it('user of project A cannot create a task in project B (returns 404)', async () => {
    mockPrismaProjectMember.findUnique.mockResolvedValue(null)

    const tokenA = makeTokenFor(USER_A_ID, USER_A_EMAIL)
    const { status } = await authPost(
      `/api/projects/${PROJECT_B_ID}/tasks`,
      { input: VALID_INPUT },
      tokenA
    )

    expect([403, 404]).toContain(status)
  })

  it('user of project A cannot execute a task belonging to project B (returns 404)', async () => {
    // No membership in project B
    mockPrismaProjectMember.findUnique.mockResolvedValue(null)

    const tokenA = makeTokenFor(USER_A_ID, USER_A_EMAIL)
    const { status } = await authPost(
      `/api/projects/${PROJECT_B_ID}/tasks/${TASK_B_ID}/execute`,
      {},
      tokenA
    )

    expect([403, 404]).toContain(status)
  })
})

describe('Cross-tenant isolation — knowledge items', () => {
  it('user of project A cannot list knowledge items of project B (returns 404)', async () => {
    mockPrismaProjectMember.findUnique.mockResolvedValue(null)

    const tokenA = makeTokenFor(USER_A_ID, USER_A_EMAIL)
    const { status } = await authGet(`/api/projects/${PROJECT_B_ID}/knowledge`, tokenA)

    expect([403, 404]).toContain(status)
  })

  it('user of project A cannot search knowledge items of project B (returns 404)', async () => {
    mockPrismaProjectMember.findUnique.mockResolvedValue(null)

    const tokenA = makeTokenFor(USER_A_ID, USER_A_EMAIL)
    const { status } = await authGet(
      `/api/projects/${PROJECT_B_ID}/knowledge/search?q=campaign`,
      tokenA
    )

    expect([403, 404]).toContain(status)
  })

  it('user of project A cannot create knowledge items in project B (returns 404)', async () => {
    mockPrismaProjectMember.findUnique.mockResolvedValue(null)

    const tokenA = makeTokenFor(USER_A_ID, USER_A_EMAIL)
    const { status } = await authPost(
      `/api/projects/${PROJECT_B_ID}/knowledge`,
      { category: 'TEMPLATE', content: 'Some knowledge content here.' },
      tokenA
    )

    expect([403, 404]).toContain(status)
  })

  it('user A can read their own project A knowledge items, not project B items', async () => {
    // Member only for project A
    mockPrismaProjectMember.findUnique.mockImplementation(
      ({ where }: { where: { userId_projectId: { userId: string; projectId: string } } }) => {
        const { userId, projectId } = where.userId_projectId
        if (userId === USER_A_ID && projectId === PROJECT_A_ID) {
          return Promise.resolve({ userId: USER_A_ID, projectId: PROJECT_A_ID, role: 'MEMBER' })
        }
        return Promise.resolve(null)
      }
    )

    mockPrismaTransaction.knowledgeItem.findMany.mockResolvedValue([makeKnowledgeItem(PROJECT_A_ID)])

    const tokenA = makeTokenFor(USER_A_ID, USER_A_EMAIL)

    // Project A access should succeed
    const { status: statusA } = await authGet(`/api/projects/${PROJECT_A_ID}/knowledge`, tokenA)
    expect(statusA).toBe(200)

    // Project B access must be denied
    const { status: statusB } = await authGet(`/api/projects/${PROJECT_B_ID}/knowledge`, tokenA)
    expect([403, 404]).toContain(statusB)
  })
})

describe('User without membership cannot access any project routes', () => {
  beforeEach(() => {
    // Simulate a user with a valid JWT but no membership in any project
    mockPrismaProjectMember.findUnique.mockResolvedValue(null)
  })

  it('cannot read tasks', async () => {
    const token = makeTokenFor(NO_MEMBER_USER_ID, NO_MEMBER_USER_EMAIL)
    const { status } = await authGet(
      `/api/projects/${PROJECT_A_ID}/tasks/${TASK_A_ID}`,
      token
    )
    expect([403, 404]).toContain(status)
  })

  it('cannot list tasks', async () => {
    const token = makeTokenFor(NO_MEMBER_USER_ID, NO_MEMBER_USER_EMAIL)
    const { status } = await authGet(`/api/projects/${PROJECT_A_ID}/tasks`, token)
    expect([403, 404]).toContain(status)
  })

  it('cannot create a task', async () => {
    const token = makeTokenFor(NO_MEMBER_USER_ID, NO_MEMBER_USER_EMAIL)
    const { status } = await authPost(
      `/api/projects/${PROJECT_A_ID}/tasks`,
      { input: VALID_INPUT },
      token
    )
    expect([403, 404]).toContain(status)
  })

  it('cannot execute a task', async () => {
    const token = makeTokenFor(NO_MEMBER_USER_ID, NO_MEMBER_USER_EMAIL)
    const { status } = await authPost(
      `/api/projects/${PROJECT_A_ID}/tasks/${TASK_A_ID}/execute`,
      {},
      token
    )
    expect([403, 404]).toContain(status)
  })

  it('cannot list knowledge items', async () => {
    const token = makeTokenFor(NO_MEMBER_USER_ID, NO_MEMBER_USER_EMAIL)
    const { status } = await authGet(`/api/projects/${PROJECT_A_ID}/knowledge`, token)
    expect([403, 404]).toContain(status)
  })

  it('cannot create knowledge items', async () => {
    const token = makeTokenFor(NO_MEMBER_USER_ID, NO_MEMBER_USER_EMAIL)
    const { status } = await authPost(
      `/api/projects/${PROJECT_A_ID}/knowledge`,
      { category: 'TEMPLATE', content: 'Some knowledge content here.' },
      token
    )
    expect([403, 404]).toContain(status)
  })

  it('returns 401 with no token at all', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_A_ID}/tasks`,
    })
    expect(res.statusCode).toBe(401)
  })
})
