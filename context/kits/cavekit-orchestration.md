---
created: "2026-04-20T00:00:00Z"
last_edited: "2026-04-20T00:00:00Z"
complexity: high
---

# Cavekit: Agent Orchestration

## Scope
Coordination between the API service and an external workflow engine that runs one of four agent scenarios per task. Covers the internal callback surface used by the workflow engine, the four scenario shapes, and the invariants that govern RAG reuse, structured handoffs, and iteration control.

## Requirements

### R1: Execution Intake
**Description:** The orchestrator receives a structured payload when a task is executed; the payload contains everything an agent run needs.
**Acceptance Criteria:**
- [ ] The payload delivered to the workflow engine contains executionId, taskId, projectId, input, scenario, callbackUrl, optional taskScore, and optional projectProfile.
- [ ] A persistent Execution record is created and linked to the task before the outbound call.
- [ ] The callback URL in the payload is the one the workflow engine must use to post step results.
**Dependencies:** cavekit-tasks R5

### R2: Agent Invocation Proxy
**Description:** The workflow engine does not call LLM providers directly; it proxies through an internal endpoint that enforces token budgets and records telemetry.
**Acceptance Criteria:**
- [ ] Calls without a valid internal API token header are rejected.
- [ ] Calls that would exceed the configured per-operation token budget return HTTP 429.
- [ ] Every successful call writes usage to the Billing model and to per-step telemetry.
- [ ] [GAP] Workflow code does not recover gracefully from HTTP 429 (TOKEN_LIMIT_EXCEEDED) responses.
**Dependencies:** cavekit-tokens R1, cavekit-tokens R2

### R3: Step Callback
**Description:** The workflow engine posts each agent step's result back to the API, where it is persisted and fanned out to subscribers.
**Acceptance Criteria:**
- [ ] A valid callback persists an AgentOutput record for the execution.
- [ ] A valid callback emits an agent.output SSE event to subscribers of that task.
- [ ] A failure callback emits an execution.failed SSE event.
- [ ] An unknown executionId returns HTTP 404.
- [ ] A malformed payload returns HTTP 400.
**Dependencies:** R1, cavekit-tasks R8

### R4: Execution Completion
**Description:** When the full execution finishes, the workflow engine posts a completion signal that advances the task into approval.
**Acceptance Criteria:**
- [ ] Completion callback sets task status to AWAITING_APPROVAL.
- [ ] If the completion payload carries iterationsFailed=true, task.requiresReview is set to true.
- [ ] An execution.complete SSE event is emitted.
- [ ] Unknown executionId returns HTTP 404.
**Dependencies:** R3, cavekit-tasks R6, cavekit-tasks R7

### R5: Scenario Definitions
**Description:** Four scenario shapes exist and cover the supported content production patterns.
**Acceptance Criteria:**
- [ ] Scenario A runs a single agent end-to-end.
- [ ] Scenario B runs a marketer agent, then a content_maker agent, passing the marketer output as a structured JSON brief (not freeform text).
- [ ] Scenario C runs multiple agents in parallel and merges their outputs.
- [ ] Scenario D runs marketer -> content_maker -> evaluator in a loop capped at 3 iterations.
- [ ] [GAP] The selection logic for which agent runs under Scenario A is not documented.
- [ ] [GAP] The merge format for Scenario C outputs is not documented.
**Dependencies:** R1

### R6: Iterative Evaluation (Scenario D)
**Description:** Scenario D uses an evaluator agent to decide whether the produced content is acceptable.
**Acceptance Criteria:**
- [ ] The evaluator returns a structured result with pass (boolean), score (0-100), and feedback (string).
- [ ] If pass=false and iteration count is below 3, the flow re-runs the producer with a revision delta.
- [ ] If iteration count reaches 3 without a passing evaluation, iterationsFailed=true is propagated to execution completion.
- [ ] [GAP] Manager escalation on iteration exhaustion is described in docs but only partially implemented (the implementation only sets requiresReview).
**Dependencies:** R4, R5, cavekit-approvals R4

### R7: RAG Reuse Within Execution
**Description:** Knowledge base retrieval is performed once per execution and reused across all agent steps and iterations.
**Acceptance Criteria:**
- [ ] One semantic search is executed at the start of the execution.
- [ ] The resulting prompt pack is passed to every subsequent agent call within the same execution.
- [ ] No additional semantic search is issued between iterations within a single execution.
**Dependencies:** cavekit-knowledge R4, cavekit-knowledge R5

### R8: Structured Agent Handoff
**Description:** When one agent's output feeds another, the handoff is a structured JSON object rather than freeform prose.
**Acceptance Criteria:**
- [ ] In Scenario B, the content_maker receives the marketer's output as a JSON object with named fields.
- [ ] In Scenario D, the content_maker receives the marketer's output as a JSON object with named fields.
- [ ] A freeform-only handoff is considered a violation of this requirement.

## Out of Scope
- The workflow engine's internal scheduling or retry mechanics
- Persistent replay of events for clients reconnecting to the SSE stream
- Cross-execution caching of agent outputs
- Automatic scenario upgrade or downgrade mid-run
## Source Traceability
- apps/api/src/routes/callback.ts
- apps/workflows/local_5678_igor_g/personal/orchestrator.workflow.ts
- apps/workflows/local_5678_igor_g/personal/scenario-a.workflow.ts
- apps/workflows/local_5678_igor_g/personal/scenario-b.workflow.ts
- apps/workflows/local_5678_igor_g/personal/scenario-c.workflow.ts
- apps/workflows/local_5678_igor_g/personal/scenario-d.workflow.ts

## Cross-References
- See also: cavekit-tasks.md
- See also: cavekit-knowledge.md
- See also: cavekit-tokens.md
- See also: cavekit-approvals.md

## Changes
- 2026-04-20: Removed [GAP] about runAgentStreaming — function exists in packages/ai-engine/src/claude.ts (finding F-overbuilt-1 from surveyor).
- 2026-04-20: R4 clarified — execution-complete MUST set AWAITING_APPROVAL, not COMPLETED. Code currently violates this (F-020).

## Changelog
- 2026-04-20: Initial brownfield reverse-engineering
