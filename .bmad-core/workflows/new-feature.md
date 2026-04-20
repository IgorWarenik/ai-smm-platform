# Workflow: New Feature

Use when: building any net-new functionality from scratch.

## Flow

```
PM (brief) → Analyst (spec) → Architect (design) → Dev (impl) → QA (test) → PM (accept)
```

## Steps

### Step 1 — PM: Feature Brief
**Owner**: Petra (PM)
**Output**: Feature brief sent to Analyst

Required content:
- User problem being solved
- Success metric
- Scope boundaries (what's NOT included)
- Priority (P0/P1/P2)
- Deadline or sprint target

---

### Step 2 — Analyst: Feature Spec
**Owner**: Alex (Analyst)
**Input**: PM feature brief
**Output**: `specs/<feature-name>.md` with status: draft

Checklist:
- [ ] Frontmatter complete (title, status: draft, priority, last_updated)
- [ ] `## Scope` lists all files that will change
- [ ] `## Public Contract` defines endpoints/interfaces
- [ ] `## Acceptance Criteria` — all testable, no ambiguity
- [ ] `## Open Questions` — unresolved items flagged for PM/Architect
- [ ] No contradiction with existing approved specs

PM approves → status: approved

---

### Step 3 — Architect: Solution Design
**Owner**: Arka (Architect)
**Input**: Approved spec
**Output**: Design doc or ADR in `docs/adr/`, updated contracts in `packages/shared/`

Checklist:
- [ ] Identify files to touch (validate/update `docs/context_map.md`)
- [ ] Define any new Zod schemas in `packages/shared/src/schemas.ts`
- [ ] Define any new types in `packages/shared/src/types.ts`
- [ ] Define any new enums/constants in `packages/shared/src/enums.ts`
- [ ] If DB change: update `packages/db/prisma/schema.prisma`
- [ ] Verify no architectural constraints violated (see `architect.md`)
- [ ] Write ADR if decision has long-term implications

---

### Step 4 — Dev: Implementation
**Owner**: Dex (Dev)
**Input**: Approved spec + Architect design
**Output**: PR with implementation + tests

Checklist:
- [ ] Read spec + context_map entry
- [ ] Read public contracts of dependencies (not implementation)
- [ ] Implement minimum change satisfying acceptance criteria
- [ ] Standard error format on all error paths
- [ ] Token budget enforced (if AI calls)
- [ ] project_id filter on all DB queries
- [ ] Unit tests for new logic
- [ ] Integration test for new route (happy path + error cases)
- [ ] No new `any` types

---

### Step 5 — QA: Validation
**Owner**: Quinn (QA)
**Input**: Dev PR
**Output**: QA sign-off or bug report

Checklist:
- [ ] All spec acceptance criteria pass
- [ ] Multi-tenant isolation verified
- [ ] Error responses in standard format
- [ ] Token monitoring not broken (if AI)
- [ ] Regression checklist items relevant to this feature pass

---

### Step 6 — PM: Acceptance
**Owner**: Petra (PM)
**Input**: QA sign-off
**Output**: Feature accepted → merged → sprint updated

Spec status updated to: approved (if was draft)

## Abort Conditions

- Analyst discovers spec contradicts existing approved spec → escalate to PM, pause
- Architect finds constraint violation → send back to Analyst for spec revision
- Dev discovers implementation impossible per spec → escalate to Architect
- QA finds critical isolation bug → block merge, escalate to Architect
