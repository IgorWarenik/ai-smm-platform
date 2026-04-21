# Agent Brief — Codex
## Branch: `agent/hardening`

**Stack:** Fastify + TypeScript + Prisma + Zod. You are a subcontractor; Claude is the orchestrator.

**Rules:**
- Work ONLY in your assigned files
- Do NOT merge — Claude reviews and merges
- On finish: commit, write report to `AGENTS_CHAT.md` under `## Wave 3 → Codex`
- Validation: `npx tsc --noEmit -p apps/api/tsconfig.json` + `npx vitest run` must pass

---

## Your Files (ownership)

```
packages/shared/src/schemas.ts        ← PRIMARY
apps/api/src/routes/tasks.ts          ← PRIMARY
apps/api/src/index.ts                 ← PRIMARY (env validation)
apps/api/tests/feedback.test.ts       ← PRIMARY (new file)
```

Do NOT touch: auth.ts, approvals.ts, knowledge.ts, projects.ts, profile.ts, callback.ts, feedback.ts, sse.ts, any package outside shared/

---

## Task 1 — Approval schema: enforce MIN_REVISION_FEEDBACK_CHARS

**File:** `packages/shared/src/schemas.ts`

**Problem:** `CreateApprovalSchema` has `comment: z.string().max(2000).optional()`. When `decision === REVISION_REQUESTED`, `comment` is the revision instruction passed to Scenario D agents. If the comment is missing or too short, agents receive vague instructions.

**Import** `MIN_REVISION_FEEDBACK_CHARS` from the ai-engine package — but since shared cannot import ai-engine (circular dep risk), hardcode the value as a local constant:

```typescript
const MIN_REVISION_CHARS = 50  // mirrors MIN_REVISION_FEEDBACK_CHARS in ai-engine
```

**Update** `CreateApprovalSchema` using `.superRefine()`:

```typescript
export const CreateApprovalSchema = z.object({
  decision: z.nativeEnum(ApprovalDecision),
  comment: z.string().max(2000).optional(),
}).superRefine((data, ctx) => {
  if (data.decision === ApprovalDecision.REVISION_REQUESTED) {
    if (!data.comment || data.comment.trim().length < MIN_REVISION_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: MIN_REVISION_CHARS,
        type: 'string',
        inclusive: true,
        message: `Revision feedback must be at least ${MIN_REVISION_CHARS} characters`,
        path: ['comment'],
      })
    }
  }
})
```

**Acceptance criteria:**
- `REVISION_REQUESTED` with `comment: undefined` → Zod throws 400
- `REVISION_REQUESTED` with `comment: 'too short'` (< 50 chars) → Zod throws 400
- `REVISION_REQUESTED` with `comment: 'x'.repeat(50)` → passes validation
- `APPROVED` with no comment → still passes (no change to APPROVED/REJECTED behavior)

---

## Task 2 — Add TaskQuerySchema with status filter

**File:** `packages/shared/src/schemas.ts`

**Problem:** Frontend needs to filter tasks by status (e.g., show only AWAITING_APPROVAL). Current `PaginationSchema` has no status filter.

**Add** after `PaginationSchema`:

```typescript
export const TaskQuerySchema = PaginationSchema.extend({
  status: z.nativeEnum(TaskStatus).optional(),
})
export type TaskQueryInput = z.infer<typeof TaskQuerySchema>
```

**File:** `apps/api/src/routes/tasks.ts`

**Update** `GET /api/projects/:projectId/tasks` handler to use `TaskQuerySchema`:

```typescript
import { TaskQuerySchema } from '@ai-marketing/shared'

// In the GET / handler, replace:
const query = PaginationSchema.parse(request.query)
// With:
const query = TaskQuerySchema.parse(request.query)

// And add status to the where clause:
const whereClause = { projectId, ...(query.status && { status: query.status }) }

const [tasks, total] = await tx.$transaction([
  tx.task.findMany({
    where: whereClause,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
    orderBy: { createdAt: 'desc' },
  }),
  tx.task.count({ where: whereClause }),
])
```

**Acceptance criteria:**
- `GET /tasks` with no `status` param → returns all tasks (existing behavior)
- `GET /tasks?status=AWAITING_APPROVAL` → returns only tasks with that status
- `GET /tasks?status=INVALID` → 400 (Zod validation error)

---

## Task 3 — Startup env validation (fail-fast)

**File:** `apps/api/src/index.ts`

**Problem:** Missing required env vars (DATABASE_URL, JWT_SECRET, etc.) cause cryptic runtime errors deep in the call stack. Better to fail at boot with a clear message.

**Add** a validation function before `buildApp()`:

```typescript
function validateEnv(): void {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'INTERNAL_API_TOKEN',
  ]
  const missing = required.filter((k) => !process.env[k]?.trim())
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }
}

async function main() {
  validateEnv()    // ← add this line at the top of main()
  const app = await buildApp()
  ...
}
```

**Important:** Do NOT call `validateEnv()` at module load time — only inside `main()`. Tests call `buildApp()` directly without `main()`, so this must not run during tests.

**Acceptance criteria:**
- With all required vars set → app starts normally
- With `DATABASE_URL` missing → process logs the missing key and exits with code 1
- Tests are NOT affected (they call `buildApp()` directly, not `main()`)

---

## Task 4 — Write `apps/api/tests/feedback.test.ts`

**File:** `apps/api/tests/feedback.test.ts` (new file)

**Pattern:** Follow the exact same mock pattern as `tasks.test.ts` or `knowledge.test.ts`. Key elements:
- `beforeAll` sets env vars
- `vi.mock('@ai-marketing/db', ...)` with all needed prisma models
- `vi.mock('@ai-marketing/ai-engine', ...)` with `renderTokenPrometheusMetrics`
- `vi.mock('bcryptjs', ...)` 
- `mockWPC.mockImplementation(async (_pid, _uid, cb) => cb(db))` in each `beforeEach`
- `db.$transaction.mockImplementation(...)` for both array and callback forms
- `getToken()` helper to get a real JWT via mocked login

**Models needed in prisma mock:**
```typescript
prisma: {
  user: { findUnique: vi.fn(), create: vi.fn() },
  refreshToken: { create: vi.fn().mockResolvedValue({}), findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({}) },
  projectMember: { findUnique: vi.fn() },
  task: { findFirst: vi.fn() },
  agentFeedback: {
    create: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  $transaction: vi.fn(),
}
```

**Test suites to write:**

### GET /api/projects/:projectId/tasks/:taskId/feedback
URL pattern: `/api/projects/${PROJECT_ID}/tasks/${TASK_ID}/feedback`

| Case | Setup | Expected |
|------|-------|----------|
| 200 — member gets list | membership: MEMBER, task exists, agentFeedback.findMany: [{...}] | 200, data array |
| 404 — non-member | membership: null | 404 |
| 404 — task not found | membership: MEMBER, task.findFirst: null | 404 |

### POST /api/projects/:projectId/tasks/:taskId/feedback
Body: `{ agentType: 'MARKETER', score: 4, comment: 'Good output, minor tone issues' }`

| Case | Setup | Expected |
|------|-------|----------|
| 201 — creates feedback | membership: MEMBER, task exists, agentFeedback.create returns record | 201, data |
| 400 — invalid agentType | membership: MEMBER, agentType: 'INVALID' | 400 |
| 400 — score out of range | membership: MEMBER, score: 6 | 400 |
| 404 — non-member | membership: null | 404 |
| 404 — task not found | membership: MEMBER, task.findFirst: null | 404 |

**IDs must be valid UUIDs:**
```typescript
const PROJECT_ID = 'a0000000-0000-0000-0000-000000000001'
const TASK_ID = 'b0000000-0000-0000-0000-000000000002'
const USER_ID = 'c0000000-0000-0000-0000-000000000003'
```

Note: the route is registered as `/api/projects/:projectId/tasks/:taskId/feedback` — check `apps/api/src/app.ts` for the exact prefix.

**Acceptance criteria:**
- All 8 test cases pass
- `npx vitest run apps/api/tests/feedback.test.ts` → green
- No imports from real DB/Redis

---

## Context

```
Route registration (apps/api/src/app.ts):
  feedbackRoutes registered under /api/projects/:projectId/tasks/:taskId/feedback

AgentType enum (packages/shared/src/enums.ts):
  MARKETER | CONTENT_MAKER | EVALUATOR

Valid agentType values: 'MARKETER', 'CONTENT_MAKER', 'EVALUATOR'
```

```typescript
// Key imports:
import { withProjectContext } from '@ai-marketing/db'
import { TaskQuerySchema, CreateApprovalSchema } from '@ai-marketing/shared'
```

---

## How to submit

1. Work on new branch `agent/hardening` (create from main: `git checkout -b agent/hardening`)
2. Run `npx tsc --noEmit -p apps/api/tsconfig.json` — must be clean
3. Run `npx tsc --noEmit -p packages/shared/tsconfig.json` — must be clean
4. Run `npx vitest run` — must be 103 passed (95 existing + 8 new feedback tests)
5. Commit all changes with descriptive message
6. Write report in `AGENTS_CHAT.md` under `## Wave 3 → Codex`:
   - What was done
   - Test count: before → after
   - Any deviations from the brief
7. Tell the human "done, agent/hardening ready for review"
