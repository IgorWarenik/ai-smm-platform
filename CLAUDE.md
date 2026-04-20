# Claude Code Operating Contract

This repo is shared with Codex. Read this file before making changes.

## Required Startup
1. Read `WORKPLAN.md`.
2. Read `docs/AGENT_SYNC.md`.
3. Read `docs/context_map.md`.
4. Check `git status --short --untracked-files=all`.

## Shared Work Rules
- Do not revert unknown changes. They may be Codex or user work.
- Keep edits scoped to the active task.
- Record active task, completed changes, validation, and next step in `WORKPLAN.md`.
- If blocked, write the blocker and exact next action in `WORKPLAN.md`.
- For n8n workflows, follow `docs/AGENTS.md` and always inspect current n8n sync state before editing.

## Current Source Of Truth
- `WORKPLAN.md` is the live project state.
- `docs/AGENT_SYNC.md` is the Codex/Claude coordination protocol.
- `specs/` defines feature behavior.
- `docs/context_map.md` tells which files to read for each task.

## n8n Warning
Current config and existing workflow files disagree:
- `n8nac-config.json`: `apps/workflows/local_5678_fa9037/personal`
- Existing workflows: `apps/workflows/local_5678_igor_g/personal`

Do not edit workflows until `npx --yes n8nac list` confirms active local paths.
