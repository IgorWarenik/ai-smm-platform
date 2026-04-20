# Workflow: Bug Fix

Use when: fixing a defect in existing functionality.

## Flow

```
Reporter → Analyst (triage) → Dev (fix) → QA (verify) → merge
```

Architect involved only if fix requires design change.

## Steps

### Step 1 — Triage
**Owner**: Alex (Analyst) or SM (Sam)

Classify bug severity:
| Severity | Criteria | Response |
|----------|----------|----------|
| P0-Critical | Data leak, auth bypass, data loss | Fix immediately, skip planning |
| P1-High | Feature broken, wrong output | Fix in current sprint |
| P2-Medium | Partial functionality missing | Add to backlog |
| P3-Low | Cosmetic, edge case | Backlog, low priority |

For P0: skip steps 2-3, go directly to Dev.

---

### Step 2 — Root Cause Analysis
**Owner**: Dev (Dex)

Before writing a fix:
1. Identify exact file and line causing the bug
2. Reproduce with a failing test
3. Understand WHY it's broken (not just WHAT is broken)
4. Check if same pattern exists elsewhere in codebase

---

### Step 3 — Fix
**Owner**: Dev (Dex)

Rules:
- Fix the root cause, not the symptom
- Minimum change — do not refactor surrounding code
- Add regression test that would have caught the bug
- If fix changes public contract → Architect must review first

---

### Step 4 — Verify
**Owner**: QA (Quinn)

- Confirm bug is fixed
- Confirm regression test passes
- Confirm no new failures introduced
- For P0/P1: run full regression checklist

---

## Known Bugs (from gap analysis 2026-04-19)

| ID | Severity | Description | File |
|----|----------|-------------|------|
| BUG-001 | P1 | Task input no length validation | `packages/shared/src/schemas.ts` |
| BUG-002 | P1 | `full_name` vs `name` field mismatch | `packages/shared/src/schemas.ts`, `apps/api/src/routes/auth.ts` |
| BUG-003 | P1 | `isValid` not returned in scoring response | `apps/api/src/services/scoring.ts` |
| BUG-004 | P1 | Error response format inconsistent | All route files |
| BUG-005 | P2 | API_SPEC.md documents endpoints that don't exist | `docs/API_SPEC.md` |
