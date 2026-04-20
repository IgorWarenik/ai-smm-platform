# Task: Create Architecture Decision Record (ADR)

**Owner**: Architect (Arka)
**Trigger**: Decision with long-term implications or trade-off

## When to Write an ADR

- Choosing between two valid technical approaches
- Adding a new external dependency
- Changing a public API contract
- Modifying multi-tenant isolation strategy
- Changing token budget structure
- Any decision that would confuse a future engineer without context

## File Location

`docs/adr/NNN-short-title.md`
Increment NNN from last ADR in the directory.

## Template

```markdown
# ADR-NNN: <Title>

**Date**: YYYY-MM-DD
**Status**: proposed | accepted | deprecated | superseded by ADR-NNN

## Context

What situation requires this decision.
What forces are at play (technical, business, time).

## Decision

We will <do X>.

## Consequences

**Good:**
- <positive outcome>

**Bad / Trade-offs:**
- <negative outcome or debt incurred>

## Alternatives Considered

### Option A: <name>
<description>
**Rejected because**: <reason>

### Option B: <name>
<description>
**Rejected because**: <reason>
```

## Project-Specific ADR Topics Pending

| # | Topic | Trigger |
|---|-------|---------|
| 001 | Refresh token rotation strategy | GAP-002 |
| 002 | Standard error response format | GAP-004 |
| 003 | Scenario D iteration enforcement location (API vs workflow) | Gap analysis |
| 004 | `full_name` vs `name` field canonicalization | BUG-002 |
