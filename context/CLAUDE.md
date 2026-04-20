# Context Hierarchy

This project uses Cavekit's context hierarchy for spec-driven work.

## Tiers
- `refs/` - Source material: what is true before planning starts.
- `kits/` - Requirements: what must be true. Start at `kits/cavekit-overview.md`.
- `designs/` - Visual design constraints. Use when implementing user-facing UI.
- `plans/` - Task graphs: how requirements are implemented. Start at `plans/plan-overview.md`.
- `impl/` - Implementation tracking: what has been done, skipped, or failed. Start at `impl/impl-overview.md`.

## Navigation
- For product behavior, read `kits/cavekit-overview.md` first, then the relevant domain kit.
- For implementation order, read `plans/plan-overview.md`, then the active build site.
- For current progress, read `impl/impl-overview.md` and `WORKPLAN.md`.
- For UI work, check whether `DESIGN.md` or `context/designs/` has been created before implementing screens.
