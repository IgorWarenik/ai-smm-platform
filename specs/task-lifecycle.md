title: Task lifecycle and scoring
status: approved
priority: high
last_updated: 2026-04-10

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
- Task creation accepts `{ "input": string }`.
- `input` must be 10-5000 characters.
- Task scoring returns `score`, `scenario`, `reasoning`, `isValid`, and optional `clarificationQuestions`.
- The minimum execution threshold is `TASK_SCORE_THRESHOLD = 25`.
- Scenarios are:
  - `A`: one agent.
  - `B`: Marketer then Content Maker.
  - `C`: independent parallel subtasks.
  - `D`: iterative refinement with Evaluator.

## Acceptance Criteria
- A task with score below 25 is stored as `REJECTED` and cannot execute.
- A valid task is stored with scenario and initial status.
- `POST /:taskId/execute` creates an execution and calls the n8n orchestrator webhook.
- Running tasks cannot be executed again concurrently.
- SSE stream route emits task-scoped events without exposing other project data.
- Scoring Claude calls go through `@ai-marketing/ai-engine` so token monitoring and limits apply.

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

