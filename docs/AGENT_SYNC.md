# Codex / Claude Sync Protocol

This file prevents Codex and Claude Code from overwriting each other.

## Session Startup
- Read `WORKPLAN.md` for current project state and active task.
- Read this file for coordination rules.
- Read `docs/context_map.md` to choose minimal context.
- Run `git status --short --untracked-files=all`.
- If another agent has touched relevant files, inspect them before editing.

## Claiming Work
- Put the active task in `WORKPLAN.md` under "Текущая задача".
- Include owner (`Codex`, `Claude`, or `User`), intent, files likely to change, and expected validation.
- Do not claim broad areas like "backend" or "workflows"; claim a narrow behavior or test.
- If you discover the task scope changed, update the same block before continuing.

## Handoff
At the end of each session, update `WORKPLAN.md` with:
- what changed;
- why it changed;
- validation run and result;
- files touched;
- next recommended step;
- blockers or risks.

Use concise bullets. Do not leave hidden context only in chat.

## Conflict Rules
- Never run destructive git commands unless explicitly requested by the user.
- Never revert unknown changes.
- If a file has mixed work from another agent, preserve it and make the smallest compatible change.
- If two agents touched the same behavior and intent conflicts, stop and record the conflict in `WORKPLAN.md`.

## n8n-as-code Rules
- `docs/AGENTS.md` is the detailed n8n-as-code contract.
- Before editing any `.workflow.ts`, run `npx --yes n8nac list` from repo root.
- Pull remote changes when `n8nac list` shows remote newer or local missing.
- Edit only files in the active local workflow directory reported by n8nac.
- Push with filename only, for example `scenario-b.workflow.ts`, never a path.
- After push, run `push --verify` or `verify <workflowId>`.
- For webhook/chat/form workflows, activate then test with `--prod` unless intentionally using manually armed test mode.

## Active n8n Workflow Path

`n8nac-config.json` active instance is `local_5678_igor_g` (verified 2026-04-28).

Active workflow directory:

```text
apps/workflows/local_5678_igor_g/personal
```

Always confirm before editing: `npx --yes n8nac list`. Stale directories `local_5678_fa9037` and `local_5678_user_04b4a55a_*` are inactive and should not be edited.

## State Files
- `WORKPLAN.md`: live state, active task, next step.
- `docs/AGENT_SYNC.md`: coordination protocol.
- `docs/AGENTS.md`: n8n-as-code workflow protocol.
- `docs/context_map.md`: minimal file map.
- `docs/DEBUG_PROTOCOL.md`: debugging flow.
