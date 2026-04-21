# Agent Brief — Codex
## Wave 8 | Branch: `agent/hardening-v5`

**Stack:** Fastify + TypeScript + Prisma. Claude is orchestrator.

**Rules:**
- New branch from main: `git checkout -b agent/hardening-v5`
- Work ONLY in assigned files
- Do NOT merge — Claude reviews
- On finish: commit, write report to `AGENTS_CHAT.md` under `## Wave 8 → Codex`
- Validation: `npx tsc --noEmit -p apps/api/tsconfig.json` + `npx vitest run` (121 currently)

---

## Your Files

```
apps/api/src/routes/tasks.ts        ← add PATCH /:taskId
apps/api/tests/tasks.test.ts        ← tests for PATCH
```

Do NOT touch any other files.

---

## Task 1 — PATCH /api/projects/:projectId/tasks/:taskId

Allow updating a task's `input` field when the task is in `PENDING` or `REJECTED` status. All other statuses must return 400.

**File:** `apps/api/src/routes/tasks.ts`

Add after the existing `DELETE /:taskId` handler (before the `POST /:taskId/execute` handler):

```typescript
// PATCH /api/projects/:projectId/tasks/:taskId
app.patch('/:taskId', async (request, reply) => {
  const { projectId, taskId } = request.params as { projectId: string; taskId: string }
  if (!assertUuid(reply, projectId, 'projectId')) return
  if (!assertUuid(reply, taskId, 'taskId')) return
  const userId = request.user.sub

  const body = z.object({ input: z.string().min(1).max(5000) }).parse(request.body)

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
  if (!membership) return reply.notFound('Project not found')

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task || task.projectId !== projectId) return reply.notFound('Task not found')

  const editableStatuses: string[] = ['PENDING', 'REJECTED']
  if (!editableStatuses.includes(task.status)) {
    return reply.badRequest(`Task cannot be edited in status ${task.status}`)
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { input: body.input },
  })

  return reply.send({ data: updated })
})
```

You will need to import `z` from `zod` at the top of the file if it's not already imported. Check first — do NOT add a duplicate import.

**Acceptance criteria:**
- PENDING task → 200 `{ data: { id, input, status, ... } }`
- REJECTED task → 200
- Task in any other status (e.g. RUNNING, COMPLETED) → 400
- Non-member → 404
- Invalid UUID → 400
- `input` empty string → 400

---

## Task 2 — Tests

**File:** `apps/api/tests/tasks.test.ts`

Add a new describe block. The `task.update` mock already exists in the mock setup (`db.task.update`).

```typescript
describe('PATCH /api/projects/:projectId/tasks/:taskId', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => { await app.close() })

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
```

**Expected test count:** 121 + 4 = **125 passing**

---

## Architecture context

```
Current passing tests: 121
Target: ≥125

assertUuid() already exists in tasks.ts — reuse it.
prisma.task.update is already mocked in the test file.
z (zod) may or may not be imported in tasks.ts — check before adding.
TaskStatus enum values: PENDING, REJECTED, RUNNING, AWAITING_CLARIFICATION,
  AWAITING_APPROVAL, APPROVED, COMPLETED, FAILED
Only PENDING and REJECTED are editable — all others must return 400.
```

---

## How to submit

1. `git checkout -b agent/hardening-v5` from main
2. Make changes
3. `npx tsc --noEmit -p apps/api/tsconfig.json` — zero errors
4. `npx vitest run` — all pass
5. Commit with descriptive message
6. Write report in `AGENTS_CHAT.md` under `## Wave 8 → Codex`
7. Tell the human "done, agent/hardening-v5 ready for review"
