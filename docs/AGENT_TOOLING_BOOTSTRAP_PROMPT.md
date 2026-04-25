# Universal Agent Tooling Bootstrap Prompt

This file is project-agnostic. Copy or paste it into a fresh Codex, Claude Code, Gemini CLI, or other AI coding chat when starting work on any repository from zero.

Goal: make the agent discover the repo, configure available tools, preserve existing work, follow spec/test/documentation discipline, and use token-saving practices automatically.

Do not paste secrets into chat. Use environment variables, local config, or the platform's secure secret store.

```text
You are starting work in an existing software repository.

Your first job is not to code. Your first job is to bootstrap yourself safely.

## 1. Ground Yourself In The Repo

Run a non-mutating discovery pass:

- Print current directory.
- Inspect `git status --short --untracked-files=all`.
- Find repo guidance files:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `GEMINI.md`
  - `.cursorrules`
  - `.windsurfrules`
  - `.clauderules`
  - `.github/copilot-instructions.md`
  - `README.md`
  - `docs/`
  - `specs/`
  - `context/`
  - `.cavekit/`
- Find manifests and build config:
  - Treat these as examples; not every repository will use every ecosystem.
  - `package.json`
  - `pnpm-workspace.yaml`
  - `turbo.json`
  - `pyproject.toml`
  - `requirements.txt`
  - `Cargo.toml`
  - `go.mod`
  - `docker-compose.yml`
  - `Makefile`
- Find test configs:
  - `vitest.config.*`
  - `jest.config.*`
  - `playwright.config.*`
  - `pytest.ini`
  - `.github/workflows/`

Read only the minimum useful files. Prefer `rg` and `rg --files` over broad directory dumps.

## 2. Build A Working Map

Create a short mental map before editing:

- project purpose;
- stack/runtime;
- package/workspace layout;
- source directories;
- test directories;
- docs/spec locations;
- build/test commands;
- deployment/runtime tools;
- current dirty worktree;
- active task or handoff file if present.

If the repo has a state file such as `WORKPLAN.md`, `TODO.md`, `context/impl/*`, or `.cavekit/state.md`, read it before making changes.

## 3. Preserve Other Work

- Treat unknown changes as user or other-agent work.
- Never revert unknown changes.
- Never run destructive git commands unless the user explicitly asks.
- Before editing, inspect files you plan to touch.
- If a file has mixed work, make the smallest compatible change.
- If work conflicts with another active task, stop and ask or record the conflict in the repo's handoff file.

## 4. Discover Tools And Capabilities

Check what is actually available. Never invent tools.

Look for:

- MCP config:
  - `.mcp.json`
  - `.cursor/mcp.json`
  - `.vscode/mcp.json`
  - `~/.codex/config.toml`
  - Claude/Codex/Gemini local config if accessible
- AI/agent plugins:
  - `~/.agents/plugins/marketplace.json`
  - `~/.codex/skills`
  - `~/.agents/skills`
  - `~/.cavekit/skills`
  - `.cavekit/`
  - `.bmad-core/`
- CLI tools:
  - `git`
  - `gh`
  - `node`, `npm`, `pnpm`, `yarn`, `npx`
  - `python3`, `pip`, `uv`
  - `docker`
  - `codex`
  - `claude`
  - `gemini`
  - `rg`
  - `jq`
  - `n8nac`
  - `playwright`
  - `vercel`
  - `supabase`
  - `wrangler`

If Cavekit is present, run its capability discovery if available, for example:

```bash
node ~/.cavekit/scripts/cavekit-tools.cjs discover
```

If capability discovery writes a repo-local capabilities file, use that as source of truth for future planning.

## 5. Use Useful MCPs When Present

Use each MCP narrowly for its actual purpose:

- Context7 or docs MCP: current library/framework documentation.
- Playwright MCP: browser automation, UI checks, screenshots, E2E validation.
- GitHub MCP or `gh`: PRs, issues, CI, Actions, repository metadata.
- Vercel MCP or CLI: deployments, runtime logs, Vercel docs, project config.
- Sentry MCP: production errors, traces, replays, releases, issue analysis.
- Greptile or code-review MCP: external review signal for risky changes.
- n8n MCP: workflow inspection/operation where configured.
- Fetch/search MCPs: source lookup and web research when current external data matters.
- Memory MCPs: stable project facts and cross-session memory, where safe.
- Sequential-thinking/planning MCPs: complex planning or ambiguity.

If an MCP is configured but not active in the current chat, say that clearly and use the best local fallback.

## 6. Use Organized Development Frameworks When Present

- Cavekit:
  - Use for spec-driven work, feature decomposition, build plans, implementation tracking, validation loops, peer review, and handoffs.
  - Prefer `context/kits`, `context/plans`, and `context/impl` over rediscovering the whole repo.
  - Use Cavekit budgets/cache/model-routing if configured.

- BMAD:
  - Use for brainstorming, document distillation, editorial review, adversarial review, edge-case hunting, and multi-agent discussion.
  - Use distillation before loading large documents into context.

- Caveman / compressed communication:
  - Use for status updates, handoffs, and long-running task summaries when token efficiency matters.
  - Keep code, specs, exact errors, and public documentation in precise normal language.

- n8n-as-code / `n8nac`:
  - Before editing workflows, run `npx --yes n8nac list`.
  - Pull if remote is newer or local is missing.
  - Edit only the active workflow directory.
  - Push with workflow filename only, not a path.
  - Verify after push.
  - Use node schema discovery before editing nodes; do not invent parameters.

## 7. Follow Spec-First Development

- Find the relevant spec before coding.
- If no spec exists for a behavioral change, create one or ask for clarification.
- Specs should include:
  - title;
  - status;
  - priority;
  - last updated date;
  - scope;
  - acceptance criteria;
  - examples/input-output where useful.
- Update specs when behavior changes.
- Implementation should trace to specs, architecture docs, or explicit user request.

## 8. Follow Test-First And Verification Discipline

- For behavior changes, add or update tests before or alongside implementation.
- Tests should map to acceptance criteria.
- Run relevant checks before declaring work done.
- Prefer nearest package/workspace commands.
- Common examples:
  - `npm test`
  - `npm run test`
  - `npm run typecheck`
  - `npm run build`
  - `npx tsc --noEmit -p <tsconfig-path>`
  - `npx vitest run --config <vitest-config>`
  - `pnpm test`
  - `pnpm typecheck`
  - `pytest`
  - `cargo test`
  - `go test ./...`
  - `docker compose config`
- For AI/provider code, use mocks in unit tests. Do not spend real model tokens in unit tests.
- If a check cannot run because dependencies or services are missing, record the exact blocker.

## 9. Keep Documentation In Sync While Coding

Update docs in parallel with code:

- Update specs for requirement changes.
- Update API docs for endpoint/payload/status changes.
- Update architecture docs for runtime/data-flow/boundary changes.
- Update setup docs for env vars, services, migrations, or commands.
- Update context maps or handoff docs when new modules or workflows are added.
- Update changelog or workplan if the repo uses one.

Add comments/docstrings where they help future agents:

- Python helpers should have type hints and docstrings when the repo actually uses Python and its local style expects it;
- TypeScript should use clear interfaces/types and names;
- comment non-obvious business rules, security constraints, token-economy choices, concurrency constraints, and workflow handoff logic;
- avoid comments that merely restate obvious code.

## 10. Respect Architecture And Module Boundaries

- Identify the actual architecture from repo docs and code.
- Do not introduce a competing framework/runtime unless explicitly planned.
- Modules should communicate through public contracts:
  - interfaces;
  - types;
  - schemas;
  - DTOs;
  - public exports;
  - API docs.
- When changing module A, read module A implementation and module B public contracts only.
- Read dependency internals only when directly changing that dependency or logs prove the bug is there.

## 11. Security And Data Safety

- Never commit secrets.
- Never paste secrets into chat.
- Use environment variables or secure secret stores.
- Preserve auth, authorization, tenant isolation, RLS, and permission semantics.
- Public inputs should go through validation schemas.
- Internal service endpoints should require internal auth where configured.
- Redact secrets from logs and final summaries.

## 12. Token Economy For Development

- Prefer small, targeted file reads.
- Use `rg` for search.
- Use repo context maps, distillates, kits, plans, and implementation notes before reading broad docs.
- Summarize command output; include only decisive lines.
- Use docs MCPs for specific questions, not broad browsing.
- Avoid repeated discovery; cache facts in the repo's handoff/state file.
- Use compressed mode for progress updates when accepted by the user/team.
- Ask for missing product intent only after repo exploration cannot answer it.

## 13. Token Economy For AI Runtime Features

If the project includes AI agents, LLM calls, embeddings, or RAG:

- Route provider calls through shared wrappers, not ad hoc direct calls.
- Enforce per-operation token budgets.
- Track provider usage and cost.
- Use prompt/semantic cache where safe.
- Use embedding cache before outbound embedding calls.
- Use RAG budgets:
  - max chars per chunk;
  - max total context;
  - minimum similarity/relevance threshold.
- Build compact prompt packs or summaries instead of injecting raw documents.
- Fetch RAG once per execution and reuse it across steps.
- Use short role cards instead of long repeated agent descriptions.
- Use strict structured handoffs between agents.
- Use delta-only revision loops.
- Keep evaluator/reviewer prompts compact and structured.
- Expose metrics and alert near budget limits when the project supports it.

## 14. Debugging Protocol

- Do not guess.
- Capture exact command, exit code, logs, stack trace, HTTP body, or failing assertion.
- Classify the failure.
- Form one small hypothesis.
- Make the smallest fix.
- Re-run the relevant check.
- Record validation result and remaining risk.

## 15. Definition Of Done

Work is done only when:

- relevant spec or documented request exists;
- implementation follows current architecture;
- tests were added/updated when behavior changed;
- relevant checks ran and passed, or blockers are documented;
- docs/comments were updated where needed;
- handoff/workplan/state file is updated if present;
- no secrets are introduced;
- unknown user/agent work is preserved.

## 16. Final Response

Report:

- what changed;
- files changed;
- checks run and results;
- blockers or skipped checks;
- next useful step.

Keep it concise.
```

## Optional Bootstrap Files To Add To A New Repo

For a repo that has no agent operating rules yet, create these lightweight files:

- `AGENTS.md`: shared rules for all coding agents.
- `CLAUDE.md`: Claude Code startup rules if Claude is used.
- `GEMINI.md`: Gemini startup rules if Gemini is used.
- `WORKPLAN.md`: current task, status, handoff, next step.
- `docs/context_map.md`: which files to read for each subsystem.
- `docs/AGENT_SYNC.md`: multi-agent coordination and conflict rules.
- `docs/DEBUG_PROTOCOL.md`: debugging loop and required evidence.
- `docs/TEST_GUIDE.md`: test commands and expectations.
- `specs/README.md`: spec index and spec format.

## Optional Tooling To Install Or Enable

- Cavekit: spec-driven kits, plans, implementation tracking, validation, peer review.
- BMAD skills: brainstorming, distillation, adversarial review, editorial review, edge-case hunting.
- Caveman/compressed mode: shorter agent status and handoff messages.
- Context7/docs MCP: current dependency docs.
- Playwright MCP: browser/E2E/UI verification.
- GitHub MCP or `gh`: PR/issue/CI integration.
- Sentry MCP: production issue triage.
- Vercel MCP/CLI: deployment and runtime logs.
- Greptile/code-review MCP: external AI review.
- n8n MCP + `n8nac`: workflow-as-code projects.
- Fetch/search MCPs: targeted web/source lookup.
- Memory MCP: stable cross-session project facts when safe.

## Minimal Agent Operating Contract Template

```md
# Agent Operating Contract

Read this before changing code.

1. Read repo state/handoff first.
2. Check git status.
3. Read relevant spec and context map.
4. Preserve unknown changes.
5. Make scoped changes only.
6. Update tests for behavior changes.
7. Run relevant checks.
8. Update docs and handoff.
9. Never commit secrets.
10. Summarize changed files, checks, blockers, and next step.
```
