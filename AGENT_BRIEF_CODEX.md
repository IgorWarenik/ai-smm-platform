# Agent Brief — Codex
## Wave 14 | Branch: `agent/bugfix-v1`

**Goal:** Autonomous production error collection and fixing.
Collect errors from the running Docker stack, reproduce them, fix the root cause, validate.

**Rules:**
- Branch from main: `git checkout -b agent/bugfix-v1`
- Touch ONLY files relevant to each fix
- Do NOT touch `apps/api/src/routes/auth.ts` or Prisma schema
- Do NOT merge — Claude reviews
- On finish: commit all, write report to `AGENTS_CHAT.md` under `## Wave 14 → Codex`

---

## Context — Running Stack

Docker Compose is running on non-standard ports:

| Service | Container | Port |
|---------|-----------|------|
| Fastify API | `ai-marketing-api` | http://localhost:3001 |
| Next.js Frontend | `ai-marketing-frontend` | http://localhost:3002 |
| n8n | `ai-marketing-n8n` | http://localhost:5678 |
| PostgreSQL | `ai-marketing-postgres` | localhost:5432 |
| Redis | `ai-marketing-redis` | localhost:6380 |

Test user: `igorwarenik@gmail.com` / `Admin1234!`

---

## Step 1 — Collect Errors

Run these commands to extract production errors:

```bash
# API errors (4xx / 5xx)
docker logs ai-marketing-api 2>&1 | grep -E '"statusCode":(4|5)[0-9]{2}' | tail -40

# API stderr
docker logs ai-marketing-api 2>&1 | grep -iE 'error|fail|exception|prisma' | tail -40

# Frontend build/runtime errors
docker logs ai-marketing-frontend 2>&1 | grep -iE 'error|warn' | tail -20

# n8n errors
docker logs ai-marketing-n8n 2>&1 | grep -iE 'error|fail' | tail -20
```

Catalog every unique error with: endpoint, status code, error message.

---

## Step 2 — Known Bugs to Fix

### Bug 1 — Profile PUT 400: ToneOfVoice enum mismatch (FIXED by Claude in Wave 14 pre-brief)

**Root cause already fixed:** `apps/frontend/src/app/projects/[id]/profile/page.tsx`
`TOV_OPTIONS` was `['FORMAL', 'FRIENDLY', 'EXPERT', 'CASUAL', 'INSPIRATIONAL']` — three values
that don't exist in the `ToneOfVoice` enum (`OFFICIAL | FRIENDLY | EXPERT | PROVOCATIVE`).
Claude already patched this. **Verify the fix is committed. If not, apply it:**

```typescript
// apps/frontend/src/app/projects/[id]/profile/page.tsx  line 6
const TOV_OPTIONS = ['OFFICIAL', 'FRIENDLY', 'EXPERT', 'PROVOCATIVE']
```

**Verify fix works:**
```bash
curl -s -X PUT http://localhost:3001/api/projects/<any-project-id>/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"companyName":"Test Co","description":"Test description min 10","niche":"Tech","tov":"OFFICIAL"}' \
  | jq '.error // "OK"'
# must return "OK" or profile data, not validation error
```

### Bug 2 — Profile PUT 400: `description` too short

**Problem:** `CreateProjectProfileSchema` requires `description: z.string().min(10)`.
Frontend HTML `required` attribute does not enforce minimum length.
If user types fewer than 10 chars, API returns 400.

**Fix:** Add client-side validation in the frontend form.

File: `apps/frontend/src/app/projects/[id]/profile/page.tsx`

In `handleSave`, before the `apiFetch` call, add validation:
```typescript
const handleSave = async (e: React.FormEvent) => {
  e.preventDefault()
  setSaving(true)
  setError('')
  setSuccess('')

  // client-side validation
  if (form.description.trim().length < 10) {
    setError('Description must be at least 10 characters')
    setSaving(false)
    return
  }

  try {
    // ... existing apiFetch code
```

### Bug 3 — Any other 4xx/5xx errors found in Step 1

For each unique error you find in docker logs:

1. Identify the route and reproduce with curl
2. Find root cause: schema mismatch, missing field, wrong enum, prisma error
3. Fix in the relevant file (`apps/api/src/routes/*.ts` or `apps/frontend/src/**/*.tsx`)
4. Verify with curl or unit test

**Schema locations:**
- API Zod schemas: `packages/shared/src/schemas.ts`
- Prisma enums: `packages/db/prisma/schema.prisma`
- Route handlers: `apps/api/src/routes/`
- Frontend API calls: `apps/frontend/src/`

**Common fix patterns:**
- Enum mismatch → align frontend constants with `packages/db/prisma/schema.prisma` enums
- Field missing in request body → check schema default, add to frontend form
- UUID not generated → ensure `id: randomUUID()` in every `.create()` call (Wave 13 fix)
- Prisma P2025 (not found) → check membership guard returns 404 not 500

---

## Step 3 — Frontend TypeScript Sync

After any frontend fix, run:
```bash
cd /repo
npx tsc --noEmit -p apps/frontend/tsconfig.json 2>&1 | head -20
# must show 0 errors
```

---

## Step 4 — API TypeScript + Tests

```bash
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -10
# must show 0 errors

npx vitest run --config vitest.config.ts 2>&1 | tail -5
# must show 127 passed (or more if you add tests)
```

---

## Step 5 — Rebuild Frontend Docker Image

After any frontend change, rebuild container so changes take effect:
```bash
docker compose build frontend && docker compose up -d frontend
```

Wait 15s, then verify: `curl -s http://localhost:3002 | head -5`

---

## Reporting

Commit message: `fix(bugfix-v1): production error fixes Wave 14`

Write to `AGENTS_CHAT.md` under `## Wave 14 → Codex`:
- List every bug found in docker logs (even unfixed ones, with reason)
- List every file changed with one-line description
- Paste tsc + vitest results
- Paste curl verification results for Bug 1 and Bug 2
- Note any bugs that need Claude review

Tell human: "done, agent/bugfix-v1 ready for review"
