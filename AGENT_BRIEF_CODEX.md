# Agent Brief — Codex
## Branch: `agent/routes`

You are working on the **AI Marketing Platform** — a Fastify (Node.js/TypeScript) backend with Prisma + PostgreSQL, Redis, pgvector, and n8n workflows.

**You are a subcontractor. Claude is the orchestrator.**  
- Work ONLY in your assigned files (listed below)  
- Do NOT touch packages/, schema.prisma, or any test files  
- Do NOT merge your own PR — Claude reviews and merges  
- When done, commit to `agent/routes` and notify the human

---

## Your Files (ownership)

```
apps/api/src/routes/knowledge.ts      ← PRIMARY
apps/api/src/lib/sse.ts               ← PRIMARY
```

Do NOT touch any other file.

---

## Tasks

### Task 1 — knowledge.ts: withProjectContext on embedding UPDATE (F-005 P1)

**Problem:** When a knowledge item is created, the embedding is computed asynchronously and written back via `prisma.knowledgeItem.update()` — but this write bypasses Row-Level Security because it doesn't use `withProjectContext()`.

**File:** `apps/api/src/routes/knowledge.ts`

**Find** the async embedding update code (it fires after the item is created and the HTTP response is sent). It looks roughly like:
```typescript
// async background write — runs after reply sent
embedText(body.content).then(async (vector) => {
  await prisma.knowledgeItem.update({
    where: { id: item.id },
    data: { embedding: ... }
  })
})
```

**Fix:** Wrap the update in `withProjectContext(projectId, serviceUserId, ...)`:
```typescript
const serviceUserId = process.env.INTERNAL_SERVICE_USER_ID ?? '00000000-0000-0000-0000-000000000000'
embedText(body.content).then(async (vector) => {
  await withProjectContext(projectId, serviceUserId, async (tx) => {
    await tx.knowledgeItem.update({
      where: { id: item.id },
      data: { embedding: `[${vector.join(',')}]` }
    })
  })
}).catch((err) => {
  // log but don't throw — embedding failure must not affect the created item
  console.error({ err, itemId: item.id }, 'Failed to write embedding')
})
```

**Also:** The `/search` endpoint calls `retrieveContext()` directly without project isolation at the DB layer. Ensure the search route uses `withProjectContext` for any direct Prisma reads (the RAG function itself handles isolation, but any additional Prisma reads in the route must use `withProjectContext`).

**Acceptance criteria (from cavekit-knowledge.md R3):**
- Every read/search filters by project_id
- Item in project A never returned for project B

---

### Task 2 — knowledge.ts: pagination on GET /knowledge (F-007 P1)

**Problem:** `GET /api/projects/:projectId/knowledge` returns all items without pagination.

**Fix:** Apply `PaginationSchema` (already exported from `@ai-marketing/shared`) the same way other list endpoints do:

```typescript
import { PaginationSchema } from '@ai-marketing/shared'

// In the GET / handler:
const query = PaginationSchema.parse(request.query)

const [items, total] = await tx.$transaction([
  tx.knowledgeItem.findMany({
    where: { projectId },
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
    orderBy: { createdAt: 'desc' },
  }),
  tx.knowledgeItem.count({ where: { projectId } }),
])

return reply.send({ data: items, total, page: query.page, pageSize: query.pageSize })
```

**Acceptance criteria (from cavekit-knowledge.md R2):**
- Member → items with matching project_id
- Items from other projects never appear
- Response is paginated

---

### Task 3 — sse.ts: per-task Set instead of last-write-wins (F-009 P1)

**Problem:** Current `sseManager` uses `Map<taskId, Set<fn>>` correctly for local clients, but `sseClients` (the deprecated compat shim) has a broken `delete` that does nothing — it can't delete by taskId without the function reference. Any code still using `sseClients.set()` / `sseClients.delete()` loses subscribers on overwrite.

**File:** `apps/api/src/lib/sse.ts`

**Fix:** Remove the broken `sseClients` shim entirely. Verify no code in `apps/api/src/` still imports `sseClients`. If any code uses `sseClients`, migrate it to `sseManager.register()` / `sseManager.unregister()` / `sseManager.publish()`.

Check usages:
```bash
grep -rn "sseClients" apps/api/src/
```

If zero hits → just remove the export from sse.ts.  
If hits → migrate them to `sseManager`.

**Also verify** that `tasks.ts` (the SSE stream endpoint) uses `sseManager.register()` and `sseManager.unregister()` with the send function reference, not a task-id-only delete. It should already do this — confirm and leave it as-is if correct.

**Acceptance criteria (from cavekit-tasks.md R8):**
- Multiple simultaneous subscribers on the same taskId all receive events
- Unregistering one subscriber does not drop others

---

## Environment / Architecture context

```
apps/api/src/
  app.ts          — Fastify app builder (do not touch)
  routes/
    auth.ts       — DO NOT TOUCH (owned by Gemini)
    knowledge.ts  ← YOUR FILE
    projects.ts   — DO NOT TOUCH
    tasks.ts      — DO NOT TOUCH
    approvals.ts  — DO NOT TOUCH
    callback.ts   — DO NOT TOUCH
    profile.ts    — DO NOT TOUCH
    feedback.ts   — DO NOT TOUCH
  lib/
    sse.ts        ← YOUR FILE
  services/
    scoring.ts    — DO NOT TOUCH

packages/
  shared/src/schemas.ts  — read-only (PaginationSchema, etc.)
  db/src/rls.ts          — read-only (withProjectContext)
  ai-engine/src/         — DO NOT TOUCH
```

Key imports available:
```typescript
import { withProjectContext } from '@ai-marketing/db'
import { PaginationSchema } from '@ai-marketing/shared'
import { embedText } from '@ai-marketing/ai-engine'
```

---

## TypeScript / style rules

- All params must be typed (no implicit `any`)
- Non-member requests → `reply.notFound()` (404), not `reply.forbidden()` (403)
- Errors from external calls (embeddings, etc.) must be caught and logged, not re-thrown to the client
- No new dependencies — use what's already in package.json

---

## How to submit

1. Work on branch `agent/routes`
2. Run `npx tsc --noEmit -p apps/api/tsconfig.json` — must be clean
3. Commit with descriptive message
4. Tell the human "done, branch agent/routes ready for review"

The human will show Claude your diff. Claude will review, run `/ck:check`, and merge if clean.
