# Task: Create Feature Spec

**Owner**: Analyst (Alex)
**Trigger**: PM provides feature brief

## Instructions

1. Read all existing specs in `specs/` to check for conflicts
2. Read `docs/context_map.md` to understand file ownership
3. Create `specs/<kebab-case-feature-name>.md`

## Required Sections Checklist

- [ ] YAML frontmatter (title, status: draft, priority, last_updated)
- [ ] `## Scope` — exact file paths that will change
- [ ] `## Goal` — one paragraph, user-facing problem
- [ ] `## Public Contract` — endpoints, interfaces, invariants
- [ ] `## Acceptance Criteria` — testable, no ambiguity, "Given/When/Then" preferred
- [ ] `## Open Questions` — blockers for Architect or PM

## Quality Gates

- No acceptance criterion uses the word "should" — use "must"
- Every public contract field has a type
- Scope lists at minimum: route file, schema file, test file
- No contradiction with existing approved specs

## Output

File: `specs/<feature-name>.md` with `status: draft`
Next step: PM reviews → approves → status: approved → Architect picks up
