# Agent Brief — Codex
## Wave 6 | Branch: `agent/hardening-v3`

**Stack:** Fastify + TypeScript + Prisma. Claude is orchestrator.

**Rules:**
- New branch from main: `git checkout -b agent/hardening-v3`
- Work ONLY in assigned files
- Do NOT merge — Claude reviews
- On finish: commit, write report to `AGENTS_CHAT.md` under `## Wave 6 → Codex`
- Validation: `npx tsc --noEmit -p apps/api/tsconfig.json` + `npx vitest run` (116 currently)

---

## Your Files

```
apps/api/package.json                        ← add @fastify/rate-limit
apps/api/src/app.ts                          ← register rate-limit plugin
apps/api/src/routes/auth.ts                  ← apply rate-limit to register + login
apps/api/src/routes/projects.ts              ← add DELETE /:projectId/members/:userId
apps/api/tests/projects.test.ts              ← tests for member removal
```

Do NOT touch: tasks.ts, approvals.ts, knowledge.ts, feedback.ts, callback.ts, profile.ts, any packages/

---

## Task 1 — Install and register @fastify/rate-limit

### 1a. Add to `apps/api/package.json`

In the `"dependencies"` section, add:
```json
"@fastify/rate-limit": "^9.1.0"
```

### 1b. Register in `apps/api/src/app.ts`

Add after other plugin registrations (e.g., after `@fastify/sensible`):

```typescript
import rateLimit from '@fastify/rate-limit'

// Inside buildApp(), after sensible:
await app.register(rateLimit, {
  global: false,
  max: 20,
  timeWindow: '1 minute',
})
```

### 1c. Apply to auth routes in `apps/api/src/routes/auth.ts`

Add `config` option to the `POST /register` and `POST /login` handlers:

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

**Acceptance criteria:**
- Auth routes still pass all existing tests
- `buildApp()` succeeds with rate-limit registered
- tsc passes

---

## Task 2 — DELETE /api/projects/:projectId/members/:userId

**File:** `apps/api/src/routes/projects.ts`

Add after the existing `POST /:projectId/members` handler:

```typescript
// DELETE /api/projects/:projectId/members/:userId — remove member (OWNER only)
app.delete('/:projectId/members/:memberId', async (request, reply) => {
  const { projectId, memberId } = request.params as { projectId: string; memberId: string }
  if (!assertUuid(reply, projectId, 'projectId')) return
  if (!assertUuid(reply, memberId, 'memberId')) return
  const userId = request.user.sub

  const callerMembership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
  if (!callerMembership) return reply.notFound('Project not found')
  if (callerMembership.role !== MemberRole.OWNER) {
    return reply.forbidden('Only an OWNER can remove members')
  }

  // Cannot remove yourself if you are the last OWNER
  if (memberId === userId) {
    const ownerCount = await prisma.projectMember.count({
      where: { projectId, role: MemberRole.OWNER },
    })
    if (ownerCount <= 1) {
      return reply.badRequest('Cannot remove the last OWNER from the project')
    }
  }

  const target = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId: memberId, projectId } },
  })
  if (!target) return reply.notFound('Member not found')

  await prisma.projectMember.delete({
    where: { userId_projectId: { userId: memberId, projectId } },
  })
  return reply.code(204).send()
})
```

Note: `assertUuid` and `MemberRole` are already imported in `projects.ts` — do NOT add duplicate imports.

**Acceptance criteria:**
- OWNER removes a non-owner member → 204 no body
- OWNER removes another owner (not last) → 204 no body
- OWNER tries to remove self (last owner) → 400
- Non-owner tries to remove member → 403
- Member not found → 404
- Non-member caller → 404

---

## Task 3 — Tests for member removal

**File:** `apps/api/tests/projects.test.ts`

Add a new `describe` block at the end:

```typescript
describe('DELETE /api/projects/:projectId/members/:userId', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    app = await buildApp()
  })

  afterEach(async () => { await app.close() })

  it('204 — owner removes member', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockImplementation(({ where }: any) => {
      if (where?.userId_projectId?.userId === USER_ID) return Promise.resolve({ role: 'OWNER' })
      return Promise.resolve({ role: 'MEMBER' })
    })
    db.projectMember.delete.mockResolvedValue({})

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/members/${OTHER_USER_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(204)
  })

  it('403 — non-owner cannot remove member', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockResolvedValue({ role: 'MEMBER' })

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/members/${OTHER_USER_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
  })

  it('404 — member not found', async () => {
    const token = await getToken(app)
    db.projectMember.findUnique.mockImplementation(({ where }: any) => {
      if (where?.userId_projectId?.userId === USER_ID) return Promise.resolve({ role: 'OWNER' })
      return Promise.resolve(null)
    })

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/projects/${PROJECT_ID}/members/${OTHER_USER_ID}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })
})
```

You'll need `OTHER_USER_ID` — check if it already exists in the test file. If not, add at the top:
```typescript
const OTHER_USER_ID = 'b0000000-0000-0000-0000-000000000002'
```

Also add `projectMember.delete` and `projectMember.count` mocks to the existing `db` mock if missing:
```typescript
projectMember: {
  findUnique: vi.fn(),
  findMany: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),   // ← add if missing
  count: vi.fn().mockResolvedValue(1),  // ← add if missing
},
```

**Expected test count:** 116 + 3 = **119 passing**

---

## Architecture context

```
Current passing tests: 116
Target: ≥119

@fastify/rate-limit version: use ^9.1.0 (compatible with Fastify 4.x)
  If import fails at runtime, check if the version needs adjustment.

Existing projects.ts imports (do NOT duplicate):
  import type { FastifyInstance, FastifyReply } from 'fastify'
  import { MemberRole } from '@ai-marketing/shared'
  const UUID_RE = /^[0-9a-f]{8}-.../
  function assertUuid(...) — already exists in projects.ts

The new DELETE endpoint uses `:memberId` in path (not `:userId`)
to avoid shadowing the auth user ID variable.
```

---

## How to submit

1. `git checkout -b agent/hardening-v3` from main
2. Install: edit `apps/api/package.json` to add `@fastify/rate-limit`; run `npm install` in `apps/api/`
3. Make code changes
4. `npx tsc --noEmit -p apps/api/tsconfig.json` — zero errors
5. `npx vitest run` — all pass
6. Commit with descriptive message
7. Write report in `AGENTS_CHAT.md` under `## Wave 6 → Codex`:
   - What was done
   - Test count before → after
   - Any deviations (especially if rate-limit version needed adjustment)
8. Tell the human "done, agent/hardening-v3 ready for review"
