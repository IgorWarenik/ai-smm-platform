# Agent Brief — Codex
## Wave 5 | Branch: `agent/hardening-v2`

**Stack:** Fastify + TypeScript + Prisma. Claude is orchestrator.

**Rules:**
- New branch from main: `git checkout -b agent/hardening-v2`
- Work ONLY in assigned files
- Do NOT merge — Claude reviews
- On finish: commit, write report to `AGENTS_CHAT.md` under `## Wave 5 → Codex`
- Validation: `npx tsc --noEmit -p apps/api/tsconfig.json` + `npx vitest run` must pass (110 currently)

---

## Your Files

```
apps/api/src/app.ts                   ← rate limiting plugin
apps/api/src/routes/projects.ts       ← UUID param validation + DELETE test coverage
apps/api/src/routes/tasks.ts          ← DELETE task endpoint
apps/api/tests/projects.test.ts       ← tests for DELETE project
apps/api/tests/tasks.test.ts          ← tests for DELETE task + status filter
```

Do NOT touch: knowledge.ts, auth.ts, approvals.ts, feedback.ts, callback.ts, profile.ts, any packages/

---

## Task 1 — Rate limiting on auth routes

**File:** `apps/api/src/app.ts`

Install is already done (or use inline counter). Add `@fastify/rate-limit` registration scoped to `/api/auth`:

```typescript
import rateLimit from '@fastify/rate-limit'

// Inside buildApp(), before route registration:
await app.register(rateLimit, {
  global: false,          // opt-in per route
  max: 20,
  timeWindow: '1 minute',
})
```

Then in `apps/api/src/routes/auth.ts`, add `config: { rateLimit: { max: 20, timeWindow: '1 minute' } }` option to the `POST /register` and `POST /login` handlers:

```typescript
app.post('/register', {
  config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
}, async (request, reply) => {
  // ... existing handler unchanged
})

app.post('/login', {
  config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
}, async (request, reply) => {
  // ... existing handler unchanged
})
```

**If `@fastify/rate-limit` is not in package.json**, skip this task and note it as "package missing — needs install". Do NOT run npm install.

**Acceptance criteria:**
- `buildApp()` still succeeds
- Auth route handlers still work
- tsc passes

---

## Task 2 — DELETE /api/projects/:projectId/tasks/:taskId

**File:** `apps/api/src/routes/tasks.ts`

Add after the existing `GET /:taskId` handler:

```typescript
// DELETE /api/projects/:projectId/tasks/:taskId
app.delete('/:taskId', async (request, reply) => {
  const { projectId, taskId } = request.params as { projectId: string; taskId: string }
  const userId = request.user.sub

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
  if (!membership) return reply.notFound('Project not found')

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task || task.projectId !== projectId) return reply.notFound('Task not found')

  await prisma.task.delete({ where: { id: taskId } })
  return reply.code(204).send()
})
```

**Acceptance criteria:**
- Member DELETE existing task → 204 no body
- Non-member → 404
- Task not found → 404
- Task from different project → 404

---

## Task 3 — UUID validation helper for path params

**File:** `apps/api/src/routes/projects.ts` (and optionally tasks.ts)

Add a lightweight UUID format check at the top of the file (below imports):

```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function assertUuid(reply: FastifyReply, value: string, label: string): boolean {
  if (!UUID_RE.test(value)) {
    reply.badRequest(`${label} must be a valid UUID`)
    return false
  }
  return true
}
```

Use it at the start of handlers that take `:projectId` and `:taskId` path params:

```typescript
app.get('/:projectId', async (request, reply) => {
  const { projectId } = request.params as { projectId: string }
  if (!assertUuid(reply, projectId, 'projectId')) return
  // ... rest of handler
})
```

Apply to: `GET /:projectId`, `PATCH /:projectId`, `DELETE /:projectId` in `projects.ts`.
Apply to: `GET /:taskId`, `DELETE /:taskId` in `tasks.ts`.

**Acceptance criteria:**
- `GET /api/projects/not-a-uuid` → 400 with message "projectId must be a valid UUID"
- Valid UUID → passes through unchanged
- tsc passes

---

## Task 4 — Tests

**File:** `apps/api/tests/tasks.test.ts`

Add at the end of the file:

```typescript
describe('DELETE /api/projects/:projectId/tasks/:taskId', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => { await app.close() })

  it('204 — member deletes own task', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.task.findUnique.mockResolvedValue({ id: 'task-1', projectId: PROJECT_ID })
    db.task.delete.mockResolvedValue({})

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/tasks/task-1`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(204)
  })

  it('404 — non-member cannot delete', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/tasks/task-1`,
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
      url: `/api/projects/${PROJECT_ID}/tasks/nonexistent`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })
})
```

Also add a test for the UUID validation:

```typescript
describe('UUID validation', () => {
  let app: FastifyInstance

  beforeEach(async () => { app = await buildApp() })
  afterEach(async () => { await app.close() })

  it('400 — invalid projectId returns bad request', async () => {
    const token = await getToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/api/projects/not-a-uuid',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(400)
  })
})
```

Check existing mock in tasks.test.ts — add `delete: vi.fn()` to `task` mock if missing.

**Expected test count after this wave:** 110 + ~4 = **~114 passing**

---

## Architecture context

```
Current passing tests: 110
Target: ≥114

Existing task mock in tasks.test.ts:
  task: { create, findMany, findUnique, count }
  ← Need to ADD: task.delete mock

Existing project routes (projects.ts):
  POST   /                    create
  GET    /                    list
  GET    /:projectId          get one
  PATCH  /:projectId          update
  DELETE /:projectId          delete (already exists!)
  POST   /:projectId/members  add member

UUID_RE helper goes in BOTH projects.ts and tasks.ts as a module-level const.
```

---

## How to submit

1. `git checkout -b agent/hardening-v2` from main
2. Make changes
3. `npx tsc --noEmit -p apps/api/tsconfig.json` — zero errors
4. `npx vitest run` — all pass
5. Commit with descriptive message
6. Write report in `AGENTS_CHAT.md` under `## Wave 5 → Codex`:
   - What was done
   - Test count before → after
   - Any deviations (especially if @fastify/rate-limit was missing)
7. Tell the human "done, agent/hardening-v2 ready for review"
