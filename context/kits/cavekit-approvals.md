---
created: "2026-04-20T00:00:00Z"
last_edited: "2026-04-20T00:00:00Z"
complexity: medium
---

# Cavekit: Approvals and Feedback

## Scope
Human-in-the-loop review of completed agent executions. Covers the approval decision surface that finalizes or rejects a task after execution, the revision loop for requesting additional iterations, and per-agent feedback capture for downstream analytics.

## Requirements

### R1: Approval History
**Description:** A member can list the approval history of a task.
**Acceptance Criteria:**
- [ ] Member request returns every approval recorded for the task in chronological order.
- [ ] Non-member request returns HTTP 404.
- [ ] Each returned approval includes decision, optional comment, userId, and a timestamp.
**Dependencies:** cavekit-projects R6, cavekit-tasks R4

### R2: Approval Decision
**Description:** A member submits a decision that resolves a task currently awaiting approval.
**Acceptance Criteria:**
- [ ] Request with decision and optional comment on a task in AWAITING_APPROVAL is accepted.
- [ ] decision must be one of {APPROVE, REJECT, REVISION_REQUESTED}; other values return HTTP 400.
- [ ] comment is rejected if longer than 2000 characters.
- [ ] Request against a task not in AWAITING_APPROVAL returns an error.
- [ ] Non-member request returns HTTP 404.
**Dependencies:** R1, cavekit-tasks R6

### R3: Decision Effects on Task Status
**Description:** Each decision drives a specific task status transition.
**Acceptance Criteria:**
- [ ] APPROVE transitions the task to COMPLETED.
- [ ] REJECT transitions the task to FAILED.
- [ ] REVISION_REQUESTED re-queues the task for another execution and increments a revision counter on the task.
**Dependencies:** R2, cavekit-tasks R6

### R4: Revision Cap
**Description:** A task may not be revised indefinitely; after a fixed number of revisions the task is routed to human escalation instead of another execution.
**Acceptance Criteria:**
- [ ] A REVISION_REQUESTED decision is accepted up to 3 times for a single task.
- [ ] On the 4th REVISION_REQUESTED the task is marked with requiresReview=true.
- [ ] [GAP] Manager escalation beyond the requiresReview flag (notification, assignment) is not implemented.
- [ ] [GAP] The maximum revision count and escalation behavior are not documented in the external API spec.
**Dependencies:** R3, cavekit-tasks R7

### R5: Agent Feedback Listing
**Description:** A member can list per-agent feedback captured for a task.
**Acceptance Criteria:**
- [ ] Member request returns every feedback record for the task.
- [ ] Non-member request returns HTTP 404.
- [ ] Each record includes agentType, score, optional comment, userId, and a timestamp.
**Dependencies:** cavekit-projects R6, cavekit-tasks R4

### R6: Agent Feedback Submission
**Description:** A member can submit feedback for any of the agent roles involved in a task.
**Acceptance Criteria:**
- [ ] Request with agentType and score is accepted.
- [ ] agentType must be one of {MARKETER, CONTENT_MAKER, EVALUATOR}; other values return HTTP 400.
- [ ] score must be an integer in {1, 2, 3, 4, 5}; other values return HTTP 400.
- [ ] comment is optional.
- [ ] Multiple feedback records for the same task and different agentType are permitted.
**Dependencies:** R5

## Out of Scope
- Manager or supervisor role distinct from project membership roles
- Automatic notifications to project owners or managers on escalation
- Deletion or editing of past approval or feedback records
- Aggregated analytics dashboards built on feedback records
- Cross-task feedback trends or agent ranking

## Source Traceability
- apps/api/src/routes/approvals.ts
- apps/api/src/routes/feedback.ts
- apps/api/prisma/schema.prisma (Approval, AgentFeedback)

## Cross-References
- See also: cavekit-tasks.md
- See also: cavekit-orchestration.md

### R7: Owner Role Escalation Guard
**Description:** Only a project OWNER may grant the OWNER role. A project must always retain at least one OWNER.
**Acceptance Criteria:**
- [ ] An MEMBER attempting to grant OWNER role to another user is rejected with HTTP 403.
- [ ] An attempt to demote or remove the last OWNER in a project is rejected with HTTP 422.
**Dependencies:** cavekit-projects R6, cavekit-projects R7

## Changes
- 2026-04-20: Added R7 (Owner Role Escalation Guard) — discovered during inspection (finding F-010/F-015). MEMBER can currently grant OWNER; last OWNER can self-demote.
- 2026-04-20: R2/R3 — clarified enum: decision values are APPROVED/REJECTED/REVISION_REQUESTED (past-tense, as in Prisma schema), not base-verb APPROVE/REJECT. Kit previously used base-verb forms — aligned with code.
- 2026-04-20: R3 — REJECT decision maps task to TaskStatus.REJECTED (not FAILED). Kit previously said FAILED — aligned with code.
- 2026-04-20: R4 — on 4th REVISION_REQUESTED code currently only logs warning and keeps AWAITING_APPROVAL; does NOT set requiresReview=true. Code needs fix per kit intent.

## Changelog
- 2026-04-20: Initial brownfield reverse-engineering
