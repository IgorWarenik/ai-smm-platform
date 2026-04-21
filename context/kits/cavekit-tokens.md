---
created: "2026-04-20T00:00:00Z"
last_edited: "2026-04-20T14:30:00Z"
complexity: high
---

# Cavekit: Token Monitoring and Billing

## Scope
Cross-cutting controls on outbound LLM and embedding usage. Covers per-operation token budgets, per-provider rolling counters, response caches, telemetry capture, and the observability endpoint that exposes all of the above. Applies to every agent invocation and every embedding call anywhere in the platform.

## Requirements

### R1: Centralized Agent Invocation
**Description:** Every outbound LLM call is routed through a single invocation primitive that checks budgets, records usage, and writes telemetry.
**Acceptance Criteria:**
- [ ] A code path that calls an LLM provider directly without going through the shared invocation primitive is considered a violation of this requirement.
- [ ] A call whose projected token usage exceeds the applicable per-operation budget raises TokenLimitExceededError before any provider request is sent.
- [ ] A successful call writes usage (input tokens, output tokens, provider, operation) to the Billing model.
- [ ] A successful call writes per-step telemetry (taskId, scenario, latency, cost estimate, cache hit/miss) to the telemetry store.
**Dependencies:** none

### R2: Per-Operation Budgets
**Description:** Each operation class has its own token budget constant and the shared primitive selects the correct one.
**Acceptance Criteria:**
- [ ] Operation class scoring enforces MAX_TOKENS_SCORING.
- [ ] Operation class evaluator JSON enforces MAX_TOKENS_EVALUATOR_JSON.
- [ ] Operation class marketer brief enforces MAX_TOKENS_MARKETER_BRIEF.
- [ ] Operation class content generation enforces MAX_TOKENS_CONTENT_GENERATION.
- [ ] Operation class revision delta enforces MAX_TOKENS_REVISION_DELTA.
- [ ] MIN_REVISION_FEEDBACK_CHARS enforces minimum feedback length in Scenario D revision delta.
**Dependencies:** R1

### R3: Centralized Embedding Invocation
**Description:** Every outbound embedding call is routed through a shared primitive that checks a cache first and enforces a separate budget.
**Acceptance Criteria:**
- [ ] A code path that calls the embedding provider directly without going through the shared primitive is considered a violation of this requirement.
- [ ] Each embedding invocation first looks up the query in the embedding cache; on a hit, no outbound call is made.
- [ ] An embedding call that would exceed the embedding budget is rejected before any provider request is sent.
- [ ] Both single-text and batch variants route through the shared primitive.
**Dependencies:** R1

### R4: Per-Provider Rolling Counters
**Description:** Token usage per provider is tracked in a rolling window so budgets apply over time, not per-call.
**Acceptance Criteria:**
- [ ] A counter keyed tokens_used:claude exists and is incremented after each successful Claude call.
- [ ] A counter keyed tokens_used:voyage exists and is incremented after each successful Voyage call.
- [ ] The window length is controlled by an environment variable TOKEN_LIMIT_WINDOW_SECONDS.
- [ ] Entries older than the window do not contribute to the current usage total.
- [ ] [GAP] TOKEN_LIMIT_WINDOW_SECONDS is not documented in external specs.
**Dependencies:** R1, R3

### R5: Prompt Cache for Non-Scoring Calls
**Description:** Ephemeral prompt caching is enabled for agent calls other than scoring to reduce repeated system-prompt token costs.
**Acceptance Criteria:**
- [ ] Scoring calls do not use the prompt cache.
- [ ] All non-scoring agent calls use the prompt cache.
- [ ] Cache creation and cache read token counts are captured in telemetry for each call.
- [ ] [GAP] The cacheCreationTokens and cacheReadTokens fields are written to telemetry but are not described in any external spec.
**Dependencies:** R1

### R6: Metrics Endpoint
**Description:** Current usage and per-step telemetry are exposed on an observability endpoint.
**Acceptance Criteria:**
- [ ] GET /metrics returns HTTP 200 with content type text/plain in Prometheus exposition format.
- [ ] The response includes per-provider token counters.
- [ ] The response includes per-step telemetry samples (scenario, latency, cost estimate, cache hit/miss).
**Dependencies:** R1, R3, R4

## Out of Scope
- Monetary invoicing or customer-facing billing
- Per-project or per-user token quotas (only per-provider and per-operation)
- Graceful shedding or retry on HTTP 429 from R1 inside workflow code (tracked as a [GAP] in cavekit-orchestration)
- Streaming LLM invocations (runAgentStreaming exists in packages/ai-engine/src/claude.ts — [GAP] annotation removed)
- Long-term archival of telemetry beyond the rolling window

## Source Traceability
- packages/token-budgets (shared constants)
- apps/api/src/services (runAgent, embedText, embedBatch equivalents)
- apps/api/src/routes/metrics (Prometheus endpoint)

## Cross-References
- See also: cavekit-orchestration.md
- See also: cavekit-knowledge.md
- See also: cavekit-tasks.md

## Changelog
- 2026-04-20: Initial brownfield reverse-engineering
