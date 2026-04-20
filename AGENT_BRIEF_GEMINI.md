# Agent Brief — Gemini
## Branch: `agent/auth-packages`

You are working on the **AI Marketing Platform** — a Fastify (Node.js/TypeScript) backend with Prisma + PostgreSQL, Redis, pgvector, and n8n workflows.

**You are a subcontractor. Claude is the orchestrator.**  
- Work ONLY in your assigned files (listed below)  
- Do NOT touch apps/api/src/routes/ (except auth.ts) or any test files  
- Do NOT merge your own PR — Claude reviews and merges  
- When done, commit to `agent/auth-packages` and notify the human

---

## Your Files (ownership)

```
apps/api/src/routes/auth.ts                  ← PRIMARY
packages/db/prisma/schema.prisma             ← PRIMARY (schema migration)
packages/db/migrations/                      ← PRIMARY (SQL migrations)
packages/shared/src/schemas.ts               ← PRIMARY
packages/shared/src/enums.ts                 ← PRIMARY
packages/ai-engine/src/token-budgets.ts      ← PRIMARY
```

Do NOT touch any other file.

---

## Tasks

### Task 1 — auth.ts: Refresh token rotation (F-004 P1)

**Problem:** Current refresh flow issues a new access token but reuses the same refresh token indefinitely. A stolen refresh token is valid forever. There is no logout endpoint.

**Requirements (cavekit-auth.md R3):**
- Refresh must issue a NEW refresh token and invalidate the old one
- Used refresh tokens must be stored so they cannot be reused
- A logout endpoint must exist that invalidates the refresh token

**Step 1 — Add `RefreshToken` model to Prisma schema**

In `packages/db/prisma/schema.prisma`, add:

```prisma
model RefreshToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("refresh_tokens")
}
```

Also add the back-relation to the `User` model:
```prisma
model User {
  // ... existing fields ...
  refreshTokens RefreshToken[]
}
```

**Step 2 — Write SQL migration**

Create `packages/db/migrations/003_refresh_tokens.sql`:
```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token       TEXT UNIQUE NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
```

**Step 3 — Update auth.ts**

Read `apps/api/src/routes/auth.ts` first to understand the current implementation.

On **login (POST /api/auth/login)**:
- After issuing tokens, store the refresh token hash in `refresh_tokens` table:
```typescript
await prisma.refreshToken.create({
  data: {
    token: refreshToken,  // store the token itself (or hash it with bcrypt)
    userId: user.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  }
})
```

On **refresh (POST /api/auth/refresh)**:
- Look up the token in `refresh_tokens` — if not found or `revokedAt` is set → 401
- If found and valid → revoke old token + issue new pair + store new refresh token:
```typescript
// Revoke old
await prisma.refreshToken.update({
  where: { token: oldRefreshToken },
  data: { revokedAt: new Date() }
})
// Store new
await prisma.refreshToken.create({
  data: { token: newRefreshToken, userId, expiresAt: ... }
})
```

Add **logout (POST /api/auth/logout)**:
```typescript
app.post('/logout', async (request, reply) => {
  // requires authentication (app.authenticate preHandler)
  const { refreshToken } = request.body as { refreshToken: string }
  if (!refreshToken) return reply.badRequest('refreshToken required')

  await prisma.refreshToken.updateMany({
    where: { token: refreshToken, userId: request.user.sub },
    data: { revokedAt: new Date() }
  })
  return reply.code(204).send()
})
```

**Acceptance criteria (cavekit-auth.md R3):**
- Valid refresh → 200 + new token PAIR (both access and refresh are new)
- Reusing the old refresh token after rotation → 401
- POST /api/auth/logout with valid refresh token → 204, token revoked

---

### Task 2 — token-budgets.ts: Add MIN_REVISION_FEEDBACK_CHARS (F-008 P2)

**Problem:** `MIN_REVISION_FEEDBACK_CHARS` is referenced in external specs but missing from the shared token-budgets package. This causes a [GAP] in cavekit-tokens.md R2.

**File:** `packages/ai-engine/src/token-budgets.ts`

Read the file first. Add the constant alongside the existing MAX_TOKENS_* constants:

```typescript
// Minimum character count for revision feedback passed to content_maker in Scenario D
export const MIN_REVISION_FEEDBACK_CHARS = 50
```

Also export it from `packages/ai-engine/src/index.ts` if it's not already re-exported there.

---

### Task 3 — Update cavekit-tokens.md [GAP] (if Task 2 is done)

After adding `MIN_REVISION_FEEDBACK_CHARS`, update `context/kits/cavekit-tokens.md`:

In R2 acceptance criteria, find:
```
- [ ] [GAP] MIN_REVISION_FEEDBACK_CHARS is referenced in external specs but not present in the shared token-budgets package.
```

Replace with:
```
- [ ] MIN_REVISION_FEEDBACK_CHARS enforces minimum feedback length in Scenario D revision delta.
```

Update `last_edited` frontmatter to today's date.

---

## Environment / Architecture context

```
packages/
  db/prisma/schema.prisma          ← add RefreshToken model
  db/migrations/                   ← add 003_refresh_tokens.sql
  shared/src/schemas.ts            ← read for existing schema patterns
  shared/src/enums.ts              ← read for existing enums
  ai-engine/src/token-budgets.ts   ← add MIN_REVISION_FEEDBACK_CHARS
  ai-engine/src/index.ts           ← add to barrel export

apps/api/src/routes/auth.ts        ← refresh rotation + logout

DO NOT TOUCH:
  apps/api/src/routes/knowledge.ts  (owned by Codex)
  apps/api/src/lib/sse.ts           (owned by Codex)
  apps/api/src/routes/tasks.ts
  apps/api/src/routes/projects.ts
  apps/api/src/routes/approvals.ts
  apps/api/src/routes/callback.ts
  apps/api/src/routes/profile.ts
  apps/api/src/routes/feedback.ts
  apps/api/src/services/scoring.ts
  apps/api/tests/                   (owned by Claude)
```

Key patterns to follow (read existing routes for examples):
- `prisma.X` for operations that don't need project-level RLS (auth is user-level)
- JWT signing uses `app.jwt.sign()` — read existing auth.ts for the exact call
- `app.authenticate` preHandler is how routes enforce auth

---

## TypeScript / style rules

- No implicit `any`
- No new npm dependencies — use what's in package.json
- Prisma client already has `refreshToken` model after schema update (no manual client generation needed in code — just run `npx prisma generate` locally to verify)
- All error responses follow the existing pattern: `reply.code(N).send({ error: '...', code: 'SNAKE_CASE' })`

---

## How to submit

1. Work on branch `agent/auth-packages`
2. Run `npx tsc --noEmit -p apps/api/tsconfig.json` — must be clean
3. Run `npx tsc --noEmit -p packages/shared/tsconfig.json` — must be clean
4. Run `npx tsc --noEmit -p packages/ai-engine/tsconfig.json` — must be clean
5. Commit with descriptive message
6. Tell the human "done, branch agent/auth-packages ready for review"

The human will show Claude your diff. Claude will review, run `/ck:check`, and merge if clean.

**Merge order:** Your branch merges FIRST (before Codex's agent/routes), because auth tests may depend on RefreshToken schema.
