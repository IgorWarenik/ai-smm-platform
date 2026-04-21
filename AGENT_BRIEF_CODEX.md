# Agent Brief — Codex
## Branch: `agent/backend-v2`

**Stack:** Fastify + TypeScript + Prisma. Claude is orchestrator.

**Rules:**
- New branch from main: `git checkout -b agent/backend-v2`
- Work ONLY in assigned files
- Do NOT merge — Claude reviews
- On finish: commit, write report to `AGENTS_CHAT.md` under `## Wave 4 → Codex`
- Validation: `npx tsc --noEmit -p apps/api/tsconfig.json` + `npx vitest run` must pass

---

## Your Files

```
apps/api/src/routes/knowledge.ts      ← PRIMARY
apps/api/tests/knowledge.test.ts      ← PRIMARY
```

Do NOT touch: tasks.ts, approvals.ts, auth.ts, projects.ts, callback.ts, profile.ts, feedback.ts, any packages/

---

## Task 1 — DELETE /api/projects/:projectId/knowledge/:itemId

**File:** `apps/api/src/routes/knowledge.ts`

Add after the existing `GET /` (list) handler:

```typescript
// DELETE /api/projects/:projectId/knowledge/:itemId
app.delete('/:itemId', async (request, reply) => {
  const { projectId, itemId } = request.params as { projectId: string; itemId: string }
  const userId = request.user.sub

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
  if (!membership) return reply.notFound('Project not found')

  return withProjectContext(projectId, userId, async (tx) => {
    const item = await tx.knowledgeItem.findUnique({ where: { id: itemId } })
    if (!item || item.projectId !== projectId) return reply.notFound('Knowledge item not found')

    await tx.knowledgeItem.delete({ where: { id: itemId } })
    return reply.code(204).send()
  })
})
```

**Acceptance criteria:**
- Member DELETE existing item → 204 no body
- Non-member → 404
- Item from different project → 404
- Item not found → 404

---

## Task 2 — PATCH /api/projects/:projectId/knowledge/:itemId

**File:** `apps/api/src/routes/knowledge.ts`

Add a `PatchKnowledgeItemSchema` at the top of the file (after existing imports):

```typescript
import { KnowledgeCategory } from '@ai-marketing/shared'

const PatchKnowledgeItemSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  metadata: z.record(z.unknown()).optional(),
  category: z.nativeEnum(KnowledgeCategory).optional(),
})
```

Note: `z` is already imported (used by the POST handler). `KnowledgeCategory` must be imported from `@ai-marketing/shared`.

Add the handler after the DELETE handler:

```typescript
// PATCH /api/projects/:projectId/knowledge/:itemId
app.patch('/:itemId', async (request, reply) => {
  const { projectId, itemId } = request.params as { projectId: string; itemId: string }
  const userId = request.user.sub
  const body = PatchKnowledgeItemSchema.parse(request.body)

  if (Object.keys(body).length === 0) {
    return reply.badRequest('At least one field required')
  }

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
  if (!membership) return reply.notFound('Project not found')

  return withProjectContext(projectId, userId, async (tx) => {
    const item = await tx.knowledgeItem.findUnique({ where: { id: itemId } })
    if (!item || item.projectId !== projectId) return reply.notFound('Knowledge item not found')

    const updated = await tx.knowledgeItem.update({
      where: { id: itemId },
      data: {
        ...(body.content !== undefined && { content: body.content }),
        ...(body.metadata !== undefined && { metadata: body.metadata }),
        ...(body.category !== undefined && { category: body.category }),
      },
    })

    // Re-embed asynchronously if content changed
    if (body.content !== undefined) {
      const serviceUserId = process.env.INTERNAL_SERVICE_USER_ID ?? '00000000-0000-0000-0000-000000000000'
      embedText(body.content).then(async (vector) => {
        await withProjectContext(projectId, serviceUserId, async (ctx) => {
          await ctx.knowledgeItem.update({
            where: { id: itemId },
            data: { embedding: `[${vector.join(',')}]` },
          })
        })
      }).catch((err) => {
        console.error({ err, itemId }, 'Failed to re-embed updated knowledge item')
      })
    }

    return reply.send({ data: updated })
  })
})
```

**Note:** `embedText` and `withProjectContext` are already imported at the top of knowledge.ts — verify before adding duplicate imports.

**Acceptance criteria:**
- PATCH content → 200 with updated item; re-embed fires async
- PATCH category → 200 with updated category
- PATCH empty body `{}` → 400
- Non-member → 404
- Item not found → 404

---

## Task 3 — Update `apps/api/tests/knowledge.test.ts`

Add two new describe blocks at the end of the file.

### Check existing mock
Verify the existing `vi.mock('@ai-marketing/db', ...)` factory includes `knowledgeItem.delete` and `knowledgeItem.update`. If missing, add them:

```typescript
knowledgeItem: {
  create: vi.fn(),
  findMany: vi.fn().mockResolvedValue([]),
  findUnique: vi.fn(),
  update: vi.fn(),          // ← needed for PATCH
  delete: vi.fn(),          // ← needed for DELETE
  count: vi.fn().mockResolvedValue(0),
},
```

### DELETE suite

```typescript
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

  afterEach(async () => { await app.close() })

  it('204 — member deletes existing item', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.knowledgeItem.findUnique.mockResolvedValue({
      id: 'item-1', projectId: PROJECT_ID,
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
```

### PATCH suite

```typescript
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

  afterEach(async () => { await app.close() })

  it('200 — updates content', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })
    db.knowledgeItem.findUnique.mockResolvedValue({ id: 'item-1', projectId: PROJECT_ID })
    db.knowledgeItem.update.mockResolvedValue({
      id: 'item-1', projectId: PROJECT_ID, content: 'Updated content',
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
```

**Expected test count after this task:** 103 existing + 7 new = **110 passing**

---

## Architecture context

```
apps/api/src/routes/knowledge.ts — current routes:
  POST   /                  → create knowledge item
  GET    /search            → semantic search (?q=)
  GET    /                  → list (paginated)
  ← ADD: DELETE /:itemId   → delete item
  ← ADD: PATCH  /:itemId   → update item

Existing imports in knowledge.ts (do NOT duplicate):
  import { prisma, withProjectContext } from '@ai-marketing/db'
  import { embedText, ... } from '@ai-marketing/ai-engine'
  import z from 'zod'
```

---

## How to submit

1. `git checkout -b agent/backend-v2` from main
2. Make changes
3. `npx tsc --noEmit -p apps/api/tsconfig.json` — zero errors
4. `npx vitest run` — 110/110 pass
5. Commit with descriptive message
6. Write report in `AGENTS_CHAT.md` under `## Wave 4 → Codex`:
   - What was done
   - Test count: 103 → 110
   - Any deviations
7. Tell the human "done, agent/backend-v2 ready for review"
