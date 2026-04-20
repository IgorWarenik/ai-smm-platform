---
created: "2026-04-20T00:00:00Z"
last_edited: "2026-04-20T00:00:00Z"
complexity: high
---

# Cavekit: Task Lifecycle

## Scope
End-to-end lifecycle of a user-submitted content task: intake, quality scoring, optional clarification loop, execution handoff to the orchestrator, and live progress streaming. Covers the task state machine and the events that drive UI updates.

## Requirements

### R1: Task Creation and Scoring
**Description:** A member can submit a task; the system scores its quality and assigns an execution scenario before persisting it.
**Acceptance Criteria:**
- [ ] Request with input between 10 and 5000 characters produces a scored task.
- [ ] Request with input shorter than 10 or longer than 5000 characters returns HTTP 400.
- [ ] A task with score below 25 is stored as REJECTED and the response is HTTP 422 with error code TASK_SCORE_TOO_LOW.
- [ ] A task with score between 25 and 39 is stored as AWAITING_CLARIFICATION; the response is HTTP 202 and includes clarificationQuestions.
- [ ] A task with score 40 or higher is stored as PENDING; the response is HTTP 201 with score and scenario.
- [ ] Non-member request returns HTTP 404.
**Dependencies:** cavekit-projects R6, cavekit-tokens R1

### R2: Scoring Zones
**Description:** The numeric score maps deterministically onto three behavior zones.
**Acceptance Criteria:**
- [ ] Scores 0-24 inclusive produce REJECTED.
- [ ] Scores 25-39 inclusive produce AWAITING_CLARIFICATION.
- [ ] Scores 40-100 inclusive produce PENDING.
- [ ] The scored result (score, zone, clarificationQuestions if any, assigned scenario if any) is stored on the task record.
**Dependencies:** R1

### R3: Clarification Round
**Description:** A task in AWAITING_CLARIFICATION can be refined by submitting an answer; the task is re-scored and its status re-evaluated.
**Acceptance Criteria:**
- [ ] Request with { answer } appends the answer to the task input and re-runs scoring.
- [ ] If the new score is below 25 the task becomes REJECTED and the response carries TASK_SCORE_TOO_LOW.
- [ ] If the new score is 25-39 the task remains AWAITING_CLARIFICATION and new clarificationQuestions are returned.
- [ ] If the new score is 40 or higher the task becomes PENDING with an assigned scenario.
- [ ] Request against a task that is not AWAITING_CLARIFICATION returns HTTP 404.
- [ ] Non-member request returns HTTP 404.
- [ ] [GAP] This endpoint is implemented but not documented in the external API spec.
**Dependencies:** R1, R2

### R4: Task Listing and Retrieval
**Description:** A member can list and fetch tasks within a project.
**Acceptance Criteria:**
- [ ] List request returns tasks scoped to the addressed project only.
- [ ] List request is paginated.
- [ ] Get by id returns HTTP 200 to a member.
- [ ] Get by id returns HTTP 404 to a non-member (regardless of whether the task exists).
**Dependencies:** cavekit-projects R6

### R5: Task Execution Trigger
**Description:** A task in PENDING can be handed off to the orchestrator for execution; the orchestrator receives the full project profile with the task payload.
**Acceptance Criteria:**
- [ ] Execute request for a PENDING task returns HTTP 202 and transitions the task to QUEUED.
- [ ] Execute request when no project profile exists returns an error with code PROFILE_MISSING.
- [ ] Execute request for a task not in PENDING returns an error (not another QUEUED transition).
- [ ] The outbound orchestrator call includes taskId, projectId, scenario, input, score, and projectProfile.
**Dependencies:** R2, cavekit-profile R7, cavekit-orchestration R1

### R6: Task Status Machine
**Description:** Task status transitions follow a fixed graph driven by scoring and execution events.
**Acceptance Criteria:**
- [ ] Allowed transitions from creation: PENDING -> QUEUED -> RUNNING -> AWAITING_APPROVAL -> COMPLETED; or ... -> FAILED.
- [ ] AWAITING_CLARIFICATION can transition to PENDING, REJECTED, or remain AWAITING_CLARIFICATION after a clarify call.
- [ ] REJECTED is terminal.
- [ ] [GAP] QUEUED exists in the schema but is not documented in the external lifecycle spec.
**Dependencies:** R1, R5, cavekit-orchestration R3

### R7: Review-Required Flag
**Description:** When an iterative scenario (D) exhausts its maximum iterations without a passing evaluator result, the task is marked for human review.
**Acceptance Criteria:**
- [ ] After execution completes with iterationsFailed=true, task.requiresReview is true.
- [ ] After execution completes with iterationsFailed=false, task.requiresReview is false.
**Dependencies:** cavekit-orchestration R6

### R8: Live Execution Stream
**Description:** A member can subscribe to live events for a running task over Server-Sent Events.
**Acceptance Criteria:**
- [ ] Subscribing with a valid access token returns a stream that emits agent.output events as agents complete their steps.
- [ ] The stream emits execution.failed on failure and execution.complete on successful finish.
- [ ] Subscribing without authentication returns HTTP 401.
- [ ] Non-member subscription returns HTTP 404.
- [ ] [GAP] The subscription map is in-process only; running more than one API instance drops events for subscribers on other instances.
- [ ] [GAP] This endpoint is implemented but not documented in the external API spec.
**Dependencies:** R5, cavekit-orchestration R3

## Out of Scope
- Manual cancellation of a running task
- Retrying a FAILED task automatically
- User-initiated override of scoring decision
- Persistent event log replay for clients reconnecting mid-execution
- Horizontally scalable SSE fanout

## Source Traceability
- apps/api/src/routes/tasks.ts
- apps/api/src/services/scoring.ts
- apps/api/prisma/schema.prisma (Task, Execution)

## Cross-References
- See also: cavekit-profile.md
- See also: cavekit-orchestration.md
- See also: cavekit-approvals.md
- See also: cavekit-tokens.md

### R9: Scoring Service Must Return clarificationQuestions When 25 ≤ Score ≤ 39
**Description:** The scoring invocation must instruct the model to produce clarifying questions when the task falls in the ambiguous zone, and the result must be passed through to the caller.
**Acceptance Criteria:**
- [ ] When the scoring model returns a score in range 25–39, the service result contains a non-empty clarificationQuestions array.
- [ ] The HTTP 202 response body for a task in AWAITING_CLARIFICATION contains at least one entry in clarificationQuestions.
- [ ] The clarificationNote stored on the task record is derived from clarificationQuestions, not empty.
**Dependencies:** R1, R2

## Changes
- 2026-04-20: Added R9 (Scoring clarificationQuestions) — discovered during inspection (finding F-001). scoreTask never emits this field; 202 responses always carry empty clarificationQuestions.

## Changelog
- 2026-04-20: Initial brownfield reverse-engineering
