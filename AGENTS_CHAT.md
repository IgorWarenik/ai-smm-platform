# Agents Chat — Handoff Reports

This file is the communication channel between Codex, Gemini, and Claude (orchestrator).

**Protocol:**
- Codex and Gemini write reports here when tasks complete
- Claude reads this file at session start, accepts work, then assigns new briefs
- One section per agent per wave

---

## Wave 4 — Knowledge CRUD + Frontend (2026-04-21)

### Codex (`agent/backend-v2`) — ACCEPTED ✅

- `apps/api/src/routes/knowledge.ts`: Added `DELETE /:itemId` (member-only, 204) and `PATCH /:itemId` (optional re-embed via async `$executeRawUnsafe`)
- `apps/api/tests/knowledge.test.ts`: Added 7 new tests (DELETE ×3, PATCH ×4) — 16/16 pass
- 110/110 total tests pass after merge.

### Gemini (`agent/frontend`) — ACCEPTED ✅

All pages implemented and merged to main. See Wave 3 frontend section.

---

## Wave 3 — Backend Hardening + Frontend Scaffold (2026-04-21)

### Codex (`agent/hardening`) — ACCEPTED ✅

- `packages/shared/src/schemas.ts`: Added `MIN_REVISION_CHARS = 50`, updated `CreateApprovalSchema` with `superRefine()`, added `TaskQuerySchema` + `TaskQueryInput`
- `apps/api/src/routes/tasks.ts`: Replaced `PaginationSchema` with `TaskQuerySchema`, added optional `status` filter
- `apps/api/src/index.ts`: Added fail-fast `validateEnv()` inside `main()` only
- `apps/api/tests/feedback.test.ts`: 8 new tests for feedback endpoints
- `apps/api/tests/approvals.test.ts`: Updated two REVISION_REQUESTED comments to ≥50 chars
- Before: 95 tests → After: 103 tests

### Gemini (`agent/frontend`) — ACCEPTED ✅

Implemented all frontend scaffold + pages on `agent/frontend` branch, merged to main:

- `apps/frontend/src/lib/api.ts` — `apiFetch` with auto-refresh on 401, token storage
- `apps/frontend/src/contexts/auth.tsx` — `AuthProvider` with login/register/logout
- `apps/frontend/src/middleware.ts` — redirect unauthenticated → `/login`
- `apps/frontend/src/components/ApprovalPanel.tsx` — approve/revision UI
- `apps/frontend/src/hooks/useTaskStream.ts` — EventSource with `?token=` query param
- `/login`, `/register`, `/dashboard`, `/projects/new`, `/projects/[id]` (tasks+layout+profile+knowledge)

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

---

## New Wave 5 Briefs

_See AGENT_BRIEF_CODEX.md and AGENT_BRIEF_GEMINI.md_
