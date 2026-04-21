# Agent Brief — Codex
## Wave 7 | Branch: `agent/hardening-v4`

**Stack:** Fastify + TypeScript + Prisma. Claude is orchestrator.

**Rules:**
- New branch from main: `git checkout -b agent/hardening-v4`
- Work ONLY in assigned files
- Do NOT merge — Claude reviews
- On finish: commit, write report to `AGENTS_CHAT.md` under `## Wave 7 → Codex`
- Validation: `npx tsc --noEmit -p apps/api/tsconfig.json` + `npx vitest run` (119 currently)

---

## Your Files

```
apps/api/src/routes/projects.ts       ← add GET /:projectId/members
apps/api/tests/projects.test.ts       ← tests for GET members
```

Do NOT touch any other files.

---

## Task 1 — GET /api/projects/:projectId/members

**File:** `apps/api/src/routes/projects.ts`

Add after the existing `POST /:projectId/members` handler (before the DELETE members handler):

```typescript
// GET /api/projects/:projectId/members
app.get('/:projectId/members', async (request, reply) => {
  const { projectId } = request.params as { projectId: string }
  if (!assertUuid(reply, projectId, 'projectId')) return
  const userId = request.user.sub

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
  if (!membership) return reply.notFound('Project not found')

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return reply.send({ data: members })
})
```

**Acceptance criteria:**
- Member GET → 200 `{ data: [{ userId, role, user: { id, email, name } }] }`
- Non-member → 404
- Invalid UUID → 400
- Empty member list (project with no members) → 200 `{ data: [] }`

---

## Task 2 — Tests

**File:** `apps/api/tests/projects.test.ts`

Add a new describe block:

```typescript
describe('GET /api/projects/:projectId/members', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => { await app.close() })

  it('200 — member gets member list', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.projectMember.findMany.mockResolvedValue([
      { userId: USER_ID, role: 'OWNER', user: { id: USER_ID, email: 'user@example.com', name: 'Owner' } },
    ])

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/members`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toHaveLength(1)
  })

  it('404 — non-member cannot list members', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'GET',
      url: `/api/projects/${PROJECT_ID}/members`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })
})
```

Check the mock for `projectMember` in the test file — `findMany` should already be mocked. If not, add it:
```typescript
projectMember: {
  findUnique: vi.fn(),
  findMany: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn().mockResolvedValue(1),
},
```

**Expected test count:** 119 + 2 = **121 passing**

---

## Architecture context

```
Current passing tests: 119
Target: ≥121

assertUuid() already exists in projects.ts — reuse it.
prisma.projectMember.findMany is already used elsewhere in projects.ts.

The Prisma User model fields available:
  id, email, name (optional), createdAt, updatedAt
  Select only: id, email, name — no passwords or refresh tokens.
```

---

## How to submit

1. `git checkout -b agent/hardening-v4` from main
2. Make changes
3. `npx tsc --noEmit -p apps/api/tsconfig.json` — zero errors
4. `npx vitest run` — all pass
5. Commit with descriptive message
6. Write report in `AGENTS_CHAT.md` under `## Wave 7 → Codex`
7. Tell the human "done, agent/hardening-v4 ready for review"
