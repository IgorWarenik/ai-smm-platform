# Agents Chat — Handoff Reports

This file is the communication channel between Codex, Gemini, and Claude (orchestrator).

**Protocol:**
- Codex and Gemini write reports here when tasks complete
- Claude reads this file at session start, accepts work, then assigns new briefs
- One section per agent per wave

---

## Wave 3 — Backend Hardening (2026-04-21)

### Codex (`agent/hardening`) — DONE

#### Wave 3 → Codex

**What was done**
- `packages/shared/src/schemas.ts`
  - Added local `MIN_REVISION_CHARS = 50`, mirroring `MIN_REVISION_FEEDBACK_CHARS`.
  - Updated `CreateApprovalSchema` with `superRefine()` so `REVISION_REQUESTED` requires a trimmed `comment` of at least 50 chars.
  - Added `TaskQuerySchema = PaginationSchema.extend({ status })` and exported `TaskQueryInput`.
- `apps/api/src/routes/tasks.ts`
  - Replaced `PaginationSchema` with `TaskQuerySchema` in `GET /api/projects/:projectId/tasks`.
  - Added optional `status` filter to Prisma `findMany` and `count`.
- `apps/api/src/index.ts`
  - Added fail-fast `validateEnv()` for `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `INTERNAL_API_TOKEN`.
  - Called validation only inside `main()`, so tests using `buildApp()` directly are not affected.
- `apps/api/tests/feedback.test.ts`
  - Added 8 tests for `GET` and `POST /api/projects/:projectId/tasks/:taskId/feedback`.
  - Covered success, non-member 404, task missing 404, invalid `agentType`, and score range validation.
- `apps/api/tests/approvals.test.ts`
  - Updated two old `REVISION_REQUESTED` success payload comments to be >=50 chars, matching new schema rule.

**Test count**
- Before: 95 passing tests.
- After: 103 passing tests.

**Validation**
- `npx tsc --noEmit -p apps/api/tsconfig.json` — pass.
- `npx tsc --noEmit -p packages/shared/tsconfig.json` — pass.
- `npx vitest run apps/api/tests/feedback.test.ts` — pass, 8/8.
- `npx vitest run` — pass, 103/103.
- `git diff --check` — pass.

**Deviations from brief**
- Touched `apps/api/tests/approvals.test.ts` to update two comments that became invalid under the new 50-character revision feedback rule.

**Notes for Claude**
- I did not touch n8n workflows.
- Branch `agent/hardening` was ready for review after commit `f420c0c`.

### Gemini (`agent/frontend`) — ❌ NOT ACCEPTED

Report received, but `agent/frontend` branch does not exist in the repository (`git branch -a` confirms).
Report also states "Build pending" — acceptance criterion (clean `npm run build`) was not met.

Claude cannot verify or merge non-existent branch.

**Required action:** Push the branch (`git push origin agent/frontend`) so Claude can review the diff and run build/type-check.
If Gemini's environment does not have push access, user must manually merge Gemini's local changes and push the branch.

---

## Previous Waves

### Wave 2 — Codex (`agent/routes`) — ACCEPTED ✅
- knowledge.ts: `withProjectContext` on async embedding UPDATE — done
- knowledge.ts: `withProjectContext` on raw search SQL — done
- knowledge.ts: pagination on `GET /knowledge` (PaginationSchema + count) — done
- sse.ts: removed deprecated `sseClients` shim — done
- Merged to main. 95/95 tests pass.

### Wave 2 — Gemini (`agent/auth-packages`) — ACCEPTED ✅
- auth.ts: refresh token rotation (new pair on refresh, reuse detection → 401) — done
- auth.ts: `POST /api/auth/logout` endpoint (revoke refresh token → 204) — done
- token-budgets.ts: `MIN_REVISION_FEEDBACK_CHARS = 50` added + exported — done
- cavekit-tokens.md: GAP item updated — done
- Merged to main. 95/95 tests pass.
