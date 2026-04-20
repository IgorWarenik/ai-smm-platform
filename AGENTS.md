# Agent Operating Contract

This repo is shared by Codex and Claude Code. Read this file before making changes.

## Start Every Session
- Read `WORKPLAN.md` first.
- Read `docs/AGENT_SYNC.md` second.
- Read `docs/context_map.md`, then only the relevant specs and files.
- Check `git status --short --untracked-files=all` before editing.
- Treat unknown changes as another agent's or user's work. Do not revert them.

## Codex Communication Mode
- Codex must use `ck:caveman ultra` for every new session by default.
- Keep technical terms exact; compress surrounding prose.
- User can override with an explicit mode change, for example `normal mode` or `ck:caveman lite`.

## Coordination Rules
- One agent owns one task at a time. Record the active task in `WORKPLAN.md` under "Текущая задача".
- Before editing n8n workflows, follow `docs/AGENT_SYNC.md` and `docs/AGENTS.md`.
- Pull/check n8n state before editing any `.workflow.ts`.
- Do not edit files outside the current task unless needed for the task.
- After changes, update `WORKPLAN.md` with what changed, why, and next step.
- If work stops mid-task, leave a clear handoff in `WORKPLAN.md`.

## Source Of Truth
- Project state: `WORKPLAN.md`
- Agent coordination: `docs/AGENT_SYNC.md`
- n8n-as-code rules: `docs/AGENTS.md`
- Feature specs: `specs/`
- Context routing: `docs/context_map.md`
- Runtime architecture: `docs/ARCHITECTURE.md`

## n8n Sync
Confirmed active path: `apps/workflows/local_5678_igor_g/personal`. `n8nac-config.json` path conflict resolved.
