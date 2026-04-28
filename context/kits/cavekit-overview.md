---
created: "2026-04-20T00:00:00Z"
last_edited: "2026-04-20T00:00:00Z"
---

# Cavekit Overview

## Project
AI SMM Platform — multi-tenant service for marketing automation and content production via AI agents. Users create projects, populate a structured brand profile and a project-scoped knowledge base, submit free-form content tasks, and receive agent-generated results produced by an external workflow engine running one of four scenario shapes. All LLM and embedding usage flows through a centralized budgeting and telemetry layer.

## Domain Index
| Domain | Cavekit File | Requirements | Status | Description |
|--------|-------------|--------------|--------|-------------|
| Auth | cavekit-auth.md | R1-R5 | Implemented, tests present; [GAP] email verification, token revocation, RS256 mismatch | User registration, login, refresh, access/refresh token semantics, authenticated user lookup |
| Projects | cavekit-projects.md | R1-R7 | Implemented, no tests; [GAP] VIEWER write rules, member role updates, member removal | Project CRUD, role-based membership (OWNER/MEMBER/VIEWER), invitations |
| Profile | cavekit-profile.md | R1-R7 | Implemented, no tests; [GAP] PATCH undocumented | Tiered project profile (required/recommended/optional) consumed by agents |
| Knowledge | cavekit-knowledge.md | R1-R6 | Implemented, tests present; [GAP] cross-project FRAMEWORK sharing, update/delete endpoints | Per-project knowledge items and RAG search with budget controls |
| Tasks | cavekit-tasks.md | R1-R8 | Partial tests (creation/scoring only); [GAP] SSE scaling, clarify/SSE undocumented, QUEUED undocumented | Task intake, scoring zones, clarification loop, execution trigger, live SSE stream |
| Orchestration | cavekit-orchestration.md | R1-R8 | Partial tests; [GAP] manager escalation, 429 handling, scenario A/C shape details, runAgentStreaming | API-to-workflow-engine coordination, 4 scenarios, structured handoffs, RAG reuse |
| Approvals | cavekit-approvals.md | R1-R6 | Implemented, no tests; [GAP] full manager escalation | Approve/reject/revision decisions, revision cap, per-agent feedback |
| Tokens | cavekit-tokens.md | R1-R6 | Implemented, no tests; [GAP] undocumented env var, cache token fields, missing streaming, missing MIN_REVISION_FEEDBACK_CHARS | Centralized LLM/embedding budgets, rolling counters, prompt cache, metrics endpoint |

Total requirements: 48 across 8 domains.

## Cross-Reference Map
- cavekit-auth <-> cavekit-projects (identity for membership)
- cavekit-projects <-> cavekit-profile (profile belongs to a project; membership gates access)
- cavekit-projects <-> cavekit-knowledge (knowledge items are project-scoped)
- cavekit-projects <-> cavekit-tasks (tasks belong to a project; membership gates access)
- cavekit-profile <-> cavekit-tasks (profile required before execution; PROFILE_MISSING)
- cavekit-tasks <-> cavekit-orchestration (execution trigger, callbacks, completion)
- cavekit-tasks <-> cavekit-approvals (AWAITING_APPROVAL resolves via approval decisions)
- cavekit-knowledge <-> cavekit-orchestration (RAG fetched once per execution, reused)
- cavekit-orchestration <-> cavekit-tokens (agent and embedding invocations budgeted)
- cavekit-approvals <-> cavekit-orchestration (revision cap interacts with iteration cap)
- cavekit-tokens <-> cavekit-knowledge (embedding cache and budget)
- cavekit-tokens <-> cavekit-tasks (scoring consumes LLM budget)

## Dependency Graph
```
cavekit-auth
    |
    v
cavekit-projects
    |----------------+----------------+----------------+
    v                v                v                v
cavekit-profile  cavekit-knowledge  cavekit-tasks    (membership gate)
    |                |                |
    |                +--------+       |
    |                         v       v
    +------------------> cavekit-orchestration
                              |                \
                              v                 v
                        cavekit-tokens      cavekit-approvals
                              ^                    |
                              |                    |
                              +--------------------+
                              (all LLM calls budgeted; revisions reuse orchestration)
```

Notes:
- cavekit-tokens is cross-cutting: every agent invocation from orchestration, every scoring call from tasks, and every embedding call from knowledge depends on it.
- No circular dependencies exist between domain surfaces; all loops are through the task status machine, which is one-directional per event.

## Open Gaps Summary
Cross-cutting gaps worth tracking at the project level:
- Email verification flow (auth)
- Token revocation / blacklist (auth)
- JWT algorithm mismatch: docs say RS256, implementation symmetric (auth)
- No tests for projects, profile, approvals, tokens
- VIEWER write rule enforcement is uneven across endpoints (projects)
- SSE stream is in-process only; no horizontal scaling (tasks)
- Manager escalation is stubbed (requiresReview flag only) instead of implemented (orchestration, approvals)
- Scenario A agent selection and Scenario C merge format are not documented (orchestration)
- runAgentStreaming referenced in external spec but absent from code (tokens, orchestration)
- Several env vars and token-cache telemetry fields are used but undocumented (tokens)

## Changelog
- 2026-04-20: Initial brownfield reverse-engineering across 8 domains
