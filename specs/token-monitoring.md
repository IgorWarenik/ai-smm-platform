title: Token monitoring and runtime limits
status: approved
priority: high
last_updated: 2026-04-11

## Scope
- `packages/ai-engine/src/token-monitor.ts`
- `packages/ai-engine/src/redis.ts`
- `packages/ai-engine/src/claude.ts`
- `packages/ai-engine/src/embeddings.ts`
- `apps/api/src/app.ts`
- `apps/api/src/routes/callback.ts`
- `docs/ARCHITECTURE.md`
- `.env.example`

## Goal
Make AI token usage visible, enforce runtime limits, and prevent agents from making unbounded Claude or Voyage calls.

## Public Contract
- Redis stores provider counters:
  - `tokens_used:claude`
  - `tokens_used:voyage`
  - `token_fallbacks:claude`
  - `token_fallbacks:voyage`
- Redis stores per-agent-step telemetry:
  - `agent_step_telemetry`
  - `agent_step_telemetry:{taskId}`
- `GET /metrics` exposes Prometheus text metrics.
- `GET /metrics` exposes provider-level metrics and operation-level token counters for dashboards and alerts.
- Claude calls use usage from Anthropic API responses.
- Voyage calls use usage from Voyage responses when available, otherwise local token estimate.
- Runtime limits are configured with `CLAUDE_TOKEN_LIMIT` and `VOYAGE_TOKEN_LIMIT`.
- Cost estimates use `CLAUDE_INPUT_COST_PER_MTOKENS` and `CLAUDE_OUTPUT_COST_PER_MTOKENS`.
- Claude output budgets are configured per task type:
  - `MAX_TOKENS_SCORING` default 512, target 300-600
  - `MAX_TOKENS_EVALUATOR_JSON` default 1024, target 800-1500
  - `MAX_TOKENS_MARKETER_BRIEF` default 2400, target 1500-3000
  - `MAX_TOKENS_CONTENT_GENERATION` default 4096, tuned by deliverable
  - `MAX_TOKENS_REVISION_DELTA` default 1500, target 800-2000
  - `MIN_REVISION_FEEDBACK_CHARS` default 40; Scenario D only starts another revision when evaluator feedback is actionable
- `0` disables enforcement for a provider.

## Acceptance Criteria
- `runAgent` and `runAgentStreaming` record Claude usage.
- `embedText` and `embedBatch` record Voyage usage.
- Claude checks token budget before provider calls and falls back to cached response for the same prompt when available.
- Voyage checks Redis embedding cache before provider calls and refuses uncached calls when the limit is exceeded.
- n8n workflows call `/api/internal/agent-completion` instead of calling Anthropic directly.
- Every agent step logs `taskId`, `scenario`, input tokens, output tokens, RAG chars/tokens, model, latency, and cost estimate.
- Scoring, evaluator JSON, marketer brief, content generation, and revision calls use separate `maxTokens` budgets.
- Evaluator operations use a compact content fragment instead of the full deliverable when the deliverable is long.
- Prometheus can scrape `/metrics` and alert at 80%, 90%, and 100% of configured limits.
- Prometheus can chart and alert on `ai_tokens_used_by_operation_total{provider,operation}` for expensive operations such as `scenario-d.revision` or `task.scoring`.

## Examples
```text
ai_tokens_used_total{provider="claude"} 12345
ai_tokens_used_total{provider="voyage"} 6789
ai_tokens_used_by_operation_total{provider="claude",operation="scenario-b.marketer"} 4200
ai_tokens_used_by_operation_total{provider="claude",operation="scenario-d.revision"} 3100
ai_token_limit{provider="claude"} 500000
ai_token_limit{provider="voyage"} 250000
ai_token_fallbacks_total{provider="claude"} 2
ai_token_cost_estimate_usd_total{provider="claude"} 0.0345
```

## Context Rules
- Include this spec for any changes to Claude/Voyage calls, Redis token counters, `/metrics`, or n8n agent completion calls.
- Do not include workflow internals unless changing provider call routing from n8n.
