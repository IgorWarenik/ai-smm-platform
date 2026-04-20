# Workflow: Spec-First (Closing Existing Gaps)

Use when: spec exists but implementation is missing or mismatched.
This is the primary workflow for P0/P1 items from gap analysis.

## Flow

```
Analyst (verify spec) → Architect (verify contracts) → Dev (implement) → QA (test)
```

## Steps

### Step 1 — Analyst: Verify Spec Is Complete
**Owner**: Alex (Analyst)

Check existing spec in `specs/`:
- Is acceptance criteria specific enough to code against?
- Does public contract include all required fields?
- Any ambiguity that would cause multiple valid interpretations?

If spec is incomplete → update spec before proceeding.

---

### Step 2 — Architect: Check Contract Delta
**Owner**: Arka (Architect)

Compare spec public contract vs current `packages/shared/src/schemas.ts`:
- What Zod schemas need to be added/changed?
- What TypeScript types need to be added/changed?
- What constants need to be added to `packages/shared/src/enums.ts`?

Write delta — only what's missing.

---

### Step 3 — Dev: Implement the Gap
**Owner**: Dex (Dev)

Rules specific to gap-closing:
- Do NOT change behavior that already works
- Do NOT refactor code outside the scope
- The gap has a spec — implement exactly what the spec says
- If the spec says X but code does Y and Y is correct → update the spec, not the code

---

### Step 4 — QA: Verify Gap Is Closed
**Owner**: Quinn (QA)

- Write test that would have caught the gap
- Confirm spec acceptance criteria now pass
- Confirm no regression

---

## Quick Reference: Open Gaps (2026-04-19)

Priority-ordered. Each has a spec reference.

### GAP-001: Task input length validation
- **Spec**: `specs/task-lifecycle.md` line 19
- **Gap**: `CreateTaskSchema` missing `min(10).max(5000)`
- **Fix**: 1 line in `packages/shared/src/schemas.ts`
- **Test**: task with 5-char input returns 400

### GAP-002: POST /auth/refresh
- **Spec**: `docs/API_SPEC.md` (needs formal spec in `specs/auth-projects-profile.md`)
- **Gap**: Endpoint not implemented
- **Fix**: Add to `apps/api/src/routes/auth.ts`
- **Design**: Needs Architect input on token rotation strategy

### GAP-003: isValid in scoring response
- **Spec**: `specs/task-lifecycle.md` line 20
- **Gap**: `isValid` computed but not returned to client
- **Fix**: Add to response in `apps/api/src/services/scoring.ts`

### GAP-004: Standard error format
- **Spec**: `docs/API_SPEC.md`
- **Gap**: Inconsistent across routes
- **Fix**: Architect defines canonical format → Dev applies across all routes

### GAP-005: full_name vs name field
- **Spec**: `docs/API_SPEC.md` says `full_name`; code uses `name`
- **Status**: CLOSED — API_SPEC.md updated to use `name`

---

## Scenario D: iterationsFailed signal (workflow change pending)

**Context**: After 3 failed Evaluator iterations, n8n routes to `SendFinalCallback`.
`iterationsFailed` flag is now supported by the API (ExecutionCompleteSchema) and Task model (`requiresReview` field).

**Workflow change needed** in `scenario-d.workflow.ts`:

In `SendFinalCallback` node, add `iterationsFailed` to the request body:

```typescript
SendFinalCallback = {
  url: '={{ $json.callbackUrl.replace("/callback", "/execution-complete") }}',
  jsonBody: {
    executionId: '={{ $json.executionId }}',
    agentType: 'CONTENT_MAKER',
    output: '={{ $json.contentOutput }}',
    evalScore: '={{ $json.evalScore }}',
    iteration: '={{ $json.iteration }}',
    status: 'completed',
    // NEW: signal that quality gate was not reached
    iterationsFailed: '={{ !$json.evalPassed && $json.iteration >= 3 }}',
  },
};
```

**Owner**: Dev (n8nac GitOps: pull → edit → push --verify → test --prod)
**Effect**: `task.requiresReview = true`, SSE event includes `requiresReview: true` → client shows warning banner.
