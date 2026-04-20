---
created: "2026-04-20T00:00:00Z"
last_edited: "2026-04-20T00:00:00Z"
---

# Review Findings

| Finding | Severity | File | Status |
|---------|----------|------|--------|
| F-001: scoreTask never returns clarificationQuestions — 202 always has empty array | P0 | apps/api/src/services/scoring.ts:46-52 | NEW |
| F-002: INTERNAL_API_TOKEN timing-unsafe equality, no boot validation, billing auth bypass | P0 | apps/api/src/routes/callback.ts:8-15 | NEW |
| F-003: withProjectContext leaks RLS context; setProjectContext dangerous across pool | P1 | packages/db/src/rls.ts:8-20 | NEW |
| F-004: Refresh tokens never rotate, no revocation, insecure JWT_SECRET fallback | P1 | apps/api/src/routes/auth.ts:77-104 | NEW |
| F-005: knowledge.ts embedding UPDATE + /search bypass RLS context | P1 | apps/api/src/routes/knowledge.ts:38-42 | NEW |
| F-006: SQL injection via categoryFilter string interpolation in rag.ts | P1 | packages/ai-engine/src/rag.ts:30 | NEW |
| F-007: GET /knowledge no pagination — unbounded result set | P1 | apps/api/src/routes/knowledge.ts:122-138 | NEW |
| F-008: Task execute race window — crash between DB commit and n8n fires stucks task in RUNNING | P1 | apps/api/src/routes/tasks.ts:245-326 | NEW |
| F-009: SSE sseClients Map last-writer-wins; second tab kills first; memory leak on close | P1 | apps/api/src/lib/sse.ts | NEW |
| F-010: OWNER can grant OWNER to anyone; last OWNER can self-demote | P1 | apps/api/src/routes/projects.ts:120-142 | NEW |
| F-011: JSON.parse in scoring.ts can throw and crash request on malformed Claude output | P2 | apps/api/src/services/scoring.ts:45 | NEW |
| F-012: isValid=false silently overridden when score>=25 — undocumented behavior | P2 | apps/api/src/services/scoring.ts:50 | NEW |
| F-013: Membership lookups done outside withProjectContext across all routes | P2 | apps/api/src/routes/tasks.ts (and others) | NEW |
| F-014: GET /projects uses userId from JWT without UUID validation guard | P2 | apps/api/src/routes/projects.ts:39-51 | NEW |
| F-015: POST /members allows MEMBER to grant OWNER role | P2 | apps/api/src/routes/projects.ts:120-142 | NEW |
| F-016: body.name && ... truthy check drops falsy-but-valid updates | P2 | apps/api/src/routes/projects.ts:94-97 | NEW |
| F-017: profile.ts returns 204 when profile missing — kit requires 404 | P2 | apps/api/src/routes/profile.ts:21 | NEW |
| F-018: pollCacheUntilAvailable spins 25s per request; stampede on slow Claude | P2 | packages/ai-engine/src/token-monitor.ts:235-243 | NEW |
| F-019: recordAgentStepTelemetry: 3 Redis round-trips per step, EXPIRE re-armed on every write | P2 | packages/ai-engine/src/token-monitor.ts:175-202 | NEW |
| F-020: execution-complete sets task→COMPLETED directly, skips AWAITING_APPROVAL | P2 | apps/api/src/routes/callback.ts:172-184 | NEW |
| F-021: app.jwt.verify return cast to weak interface instead of canonical JWTPayload | P3 | apps/api/src/routes/auth.ts:80 | NEW |
| F-022: PATCH /profile does redundant findUnique before update | P3 | apps/api/src/routes/profile.ts:64-72 | NEW |
| F-023: request.body ?? {} only on execute, inconsistent across task routes | P3 | apps/api/src/routes/tasks.ts:195 | NEW |
| F-024: POST /knowledge returns 201 even when embedding silently fails — item unsearchable | P3 | apps/api/src/routes/knowledge.ts:36-46 | NEW |
| F-025: rag.ts limit=0 returns 0 rows instead of erroring | P3 | packages/ai-engine/src/rag.ts:26 | NEW |

## Broken Tests (must fix before CI is meaningful)

| File | Problem |
|------|---------|
| apps/api/tests/tasks.test.ts | URLs /api/tasks/... don't match actual /api/projects/:id/tasks/...; payload shape mismatch |
| apps/api/tests/approvals.test.ts | Routes /api/approvals/approve don't exist; schema fields title/content/status not in Prisma |
| apps/api/tests/knowledge.test.ts | Field title not in schema; category 'BRAND' not valid enum value |
| apps/api/tests/callback.test.ts | Schema fields title/content/status don't match Prisma models |
| apps/api/tests/rag.test.ts | Imports ../src/rag-budget — doesn't exist in apps/api/src/ |
| apps/api/tests/token-monitor.test.ts | Imports ../src/token-monitor — doesn't exist; API surface mismatch |

## Missing Tests

| File | Domain |
|------|--------|
| apps/api/tests/projects.test.ts | Projects |
| apps/api/tests/profile.test.ts | Profile |

## WORKPLAN Accuracy Issues

- Stage 2 marked ✅ ЗАВЕРШЁН — FALSE (6 tests broken, 2 missing)
- Stage 3 marked apps/frontend/ инфраструктура развернута — FALSE (directory does not exist)
