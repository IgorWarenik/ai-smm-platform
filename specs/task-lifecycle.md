title: Task lifecycle and scoring
status: approved
priority: high
last_updated: 2026-04-28

## Scope
- `apps/api/src/routes/tasks.ts`
- `apps/api/src/services/scoring.ts`
- `packages/shared/src/schemas.ts`
- `packages/shared/src/enums.ts`
- `packages/db/prisma/schema.prisma`

## Goal
Accept user marketing tasks only when they have enough context, classify them into orchestration scenarios, and move them through a predictable lifecycle.

## Public Contract
- Task routes live under `/api/projects/:projectId/tasks`.
- Task creation requires project profile to be set; returns 422 `PROFILE_MISSING` otherwise.
- Task creation accepts `{ "input": string }`.
- `input` must be 10-5000 characters.
- Task is created immediately with `status: QUEUED`; scoring runs async in background.
- Task scoring returns `score`, `scenario`, `reasoning`, `isValid`, and optional `clarificationQuestions`.
- The minimum execution threshold is `TASK_SCORE_THRESHOLD = 25`.
- After scoring: score < 25 → `REJECTED`; score 25-39 → `AWAITING_CLARIFICATION`; score ≥ 40 → `PENDING`.
- After scoring reaches `PENDING`, execution starts automatically (no separate execute call needed for Scenario A; Scenarios B/C/D trigger n8n).
- Scenarios are:
  - `A`: single agent, runs directly from API (no n8n).
  - `B`: Marketer then Content Maker (n8n).
  - `C`: independent parallel subtasks (n8n).
  - `D`: iterative refinement with Evaluator (n8n).
- `POST /:taskId/clarify` re-scores with enriched input after user answers clarification questions.

## Acceptance Criteria
- A task with score below 25 is stored as `REJECTED` and cannot execute.
- A valid task is stored with scenario and initial status.
- Task creation always returns 201 with `QUEUED` status; scoring and execution are not blocking.
- Running tasks cannot be executed again concurrently.
- SSE stream route emits task-scoped events without exposing other project data.
- Scoring Claude calls go through `@ai-marketing/ai-engine` so token monitoring and limits apply.
- Scenario A runs directly from the API; n8n is not required for single-agent tasks.
- Scenario A has a local fallback draft when the model provider is unavailable.
- `PATCH /:taskId` allows updating task input for `PENDING` and `REJECTED` tasks.
- `DELETE /:taskId` removes a task and its executions.

## Examples
```json
{
  "createTask": {
    "input": "Разработай SMM-кампанию для запуска B2B SaaS продукта в Telegram и LinkedIn"
  },
  "scoringResult": {
    "score": 72,
    "scenario": "B",
    "reasoning": "Requires strategy before content execution",
    "isValid": true
  }
}
```

## Context Rules
- Include `apps/api/src/routes/tasks.ts`, `apps/api/src/services/scoring.ts`, and shared schemas/enums.
- Include workflow files only when changing execution routing or scenario behavior.
- Include `docs/agent_protocol.md` when changing handoff between agents.

