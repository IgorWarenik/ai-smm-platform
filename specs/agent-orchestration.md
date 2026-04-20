title: Agent orchestration scenarios
status: approved
priority: high
last_updated: 2026-04-11

## Scope
- `apps/workflows/local_5678_igor_g/personal/orchestrator.workflow.ts`
- `apps/workflows/local_5678_igor_g/personal/scenario-a.workflow.ts`
- `apps/workflows/local_5678_igor_g/personal/scenario-b.workflow.ts`
- `apps/workflows/local_5678_igor_g/personal/scenario-c.workflow.ts`
- `apps/workflows/local_5678_igor_g/personal/scenario-d.workflow.ts`
- `docs/agent_protocol.md`
- `docs/tool_protocol.md`

## Goal
Run the right agent workflow for each accepted task while keeping handoffs compact, observable, and bounded by token limits.

## Public Contract
- Fastify triggers n8n via the orchestrator webhook.
- n8n receives `executionId`, `taskId`, `projectId`, `input`, `scenario`, `callbackUrl`, and optional `projectProfile`.
- n8n sends agent step results to `/api/internal/callback`.
- n8n sends final completion to `/api/internal/execution-complete`.
- Claude completions from workflows must go through `POST /api/internal/agent-completion`; direct `api.anthropic.com` calls bypass token monitoring and are not allowed.
- Agent handoff uses strict JSON from `docs/agent_protocol.md`; `marketer -> content_maker` must be parseable with `JSON.parse`.
- Tool usage follows `docs/tool_protocol.md`.

## Scenario Contract
- Scenario A: run one selected agent and return its output.
- Scenario B: run Marketer, then pass a compact brief to Content Maker.
- Scenario B: retrieve RAG once, build a compact prompt pack, then pass brief digest + prompt pack to Content Maker.
- Scenario C: run Marketer and Content Maker as independent branches and merge outputs.
- Scenario D: run Marketer, Content Maker, then Evaluator; repeat only when evaluation fails, iteration count is below 3, and evaluator returned actionable revision feedback. Revisions use delta-only context.
- Scenario D evaluator reviews a compact content fragment, not the entire deliverable, when the output is long.

## Acceptance Criteria
- Every workflow callback includes `executionId`, `agentType`, `output`, `iteration`, and `status`.
- Scenario D never exceeds 3 iterations.
- Scenario B/D fail fast when the marketer handoff is not valid `strategy_to_content` JSON.
- Workflows stop on monitored completion errors, including `TOKEN_LIMIT_EXCEEDED`.
- RAG context is fetched through the Fastify knowledge API, not by direct DB access from n8n.
- Compact `ragPromptPack` is produced by the knowledge API/shared helper and reused by workflows, instead of being assembled separately in each workflow.
- Scenario B/D fetch RAG once per execution and reuse compact `ragPromptPack` data in later steps.
- Scenario D revision iterations do not repeat full RAG or full marketer handoff; they use brief digest, current draft, and evaluator feedback only.
- Scenario D evaluator input is trimmed to a relevant content fragment before calling Claude.
- Scenario D skips extra revision iterations when evaluator feedback is empty or too generic to justify another Claude call.
- Workflow files are edited through the n8n-as-code process in `docs/AGENTS.md`.

## Examples
```json
{
  "orchestratorPayload": {
    "executionId": "uuid",
    "taskId": "uuid",
    "projectId": "uuid",
    "input": "Создай кампанию запуска продукта",
    "scenario": "B",
    "callbackUrl": "http://api:3001/api/internal/callback"
  },
  "agentCompletion": {
    "systemPrompt": "You are a Senior Marketing Strategist...",
    "userMessage": "Создай кампанию запуска продукта",
    "maxTokens": 2400,
    "operation": "scenario-b.marketer"
  }
}
```

## Context Rules
- For workflow changes, read the `<workflow-map>` first when present.
- Include `docs/agent_protocol.md` and only the scenario workflow being changed.
- Do not include unrelated scenario implementations unless the task changes shared orchestrator behavior.
