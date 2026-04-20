---
created: "2026-04-20T05:17:33Z"
last_edited: "2026-04-20T05:17:33Z"
---

# Plan Overview

## Build Sites
| Site | File | Tasks | Done | Status |
|------|------|-------|------|--------|
| Brownfield backend coverage | `build-site.md` | 54 | See `WORKPLAN.md` and `context/impl/impl-overview.md` | Active |

## Active Direction
The current repository state is past the initial backend implementation and is moving into test coverage and production-readiness work. Use the existing `build-site.md` as a requirement coverage map, then prioritize the unchecked work in `WORKPLAN.md`.

Note: `cavekit --status` counts T-task completion markers in `context/impl/impl-*.md`. This repository was brownfield-mapped after much of the backend was already written, so the CLI task count starts at `0/54` until implementation records are backfilled or a focused Stage 2 build site is generated.

## Next Useful Map Pass
- Generate a focused build site for `Stage 2 - Tests`.
- Keep it tied to the existing domain kits instead of creating a second source of requirements.
