# BMAD Team — AI Marketing Platform

Project team defined by The BMAD Method. Each agent has a defined role, responsibilities, artifacts, and interaction protocol.

## Team

| Agent | File | Role | Persona |
|-------|------|------|---------|
| Analyst | `agents/analyst.md` | Business Analyst | Alex — writes specs, finds gaps |
| PM | `agents/pm.md` | Product Manager | Petra — owns roadmap, accepts features |
| Architect | `agents/architect.md` | Technical Architect | Arka — designs solutions, owns contracts |
| Dev | `agents/dev.md` | Senior Developer | Dex — implements features and fixes |
| QA | `agents/qa.md` | QA Engineer | Quinn — validates, blocks bad merges |
| SM | `agents/sm.md` | Scrum Master | Sam — removes blockers, runs ceremonies |

## Workflows

| Workflow | Use When |
|----------|----------|
| `workflows/new-feature.md` | Building net-new functionality |
| `workflows/bug-fix.md` | Fixing a defect |
| `workflows/spec-first.md` | Closing spec-implementation gaps |

## Task Templates

| Template | Use When |
|----------|----------|
| `tasks/create-spec.md` | Analyst writing a feature spec |
| `tasks/create-story.md` | PM writing a user story |
| `tasks/create-arch-doc.md` | Architect writing an ADR |

## Handoff Chain

```
Stakeholder
    ↓ request
PM (Petra) — feature brief
    ↓
Analyst (Alex) — feature spec in specs/
    ↓ approved spec
Architect (Arka) — solution design, contract delta
    ↓ design doc + contracts
Dev (Dex) — implementation + tests
    ↓ PR
QA (Quinn) — validation against acceptance criteria
    ↓ sign-off
PM (Petra) — acceptance
    ↓
SM (Sam) — sprint tracking, blocker removal throughout
```

## Current Priority Work (2026-04-19)

Workflow to use: `workflows/spec-first.md`

| # | Gap | Severity | Owner |
|---|-----|----------|-------|
| GAP-001 | Task input length validation | P0 | Dev |
| GAP-002 | POST /auth/refresh | P0 | Analyst → Architect → Dev |
| GAP-003 | isValid in scoring response | P1 | Dev |
| GAP-004 | Standard error format | P1 | Architect → Dev |
| GAP-005 | full_name vs name | P1 | Analyst decision → Dev |

## Project Invariants (never break)

1. All queries filter by `project_id` — multi-tenant isolation
2. Score < 25 → task REJECTED, no execution
3. Token budgets per operation (never shared)
4. RAG only via Fastify knowledge API (never direct DB from n8n)
5. Marketer → Content Maker handoff = strict JSON (invalid = workflow error)
6. n8n never writes to DB directly (always via callback endpoint)

## Key Files

- Product spec index: `specs/README.md`
- Context map: `docs/context_map.md`
- Architecture: `docs/ARCHITECTURE.md`
- Agent protocols: `docs/agent_protocol.md`
- Code style: `docs/CODE_STYLE.md`
- Test guide: `docs/TEST_GUIDE.md`
- Claude Code guidance: `docs/CLAUDE.md`
