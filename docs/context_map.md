# Context Map

Карта минимального контекста для разработки. Сначала выбери feature-spec, затем читай только файлы из нужного блока и публичные контракты зависимостей.

## Always Read
- `AGENTS.md` or `CLAUDE.md`
- `WORKPLAN.md`
- `docs/AGENT_SYNC.md`
- `specs/README.md`
- релевантный файл из `specs/`
- `docs/CONTEXT.md`
- `docs/agent_protocol.md`, если меняется handoff агентов

## API And Tasks
- Spec: `specs/task-lifecycle.md`
- Implementation: `apps/api/src/routes/tasks.ts`, `apps/api/src/routes/callback.ts`
- Contracts: `packages/shared/src/schemas.ts`, `packages/shared/src/types.ts`
- Exclude unless directly changing DB internals: Prisma generated output and unrelated route files.

## Agent Orchestration
- Spec: `specs/agent-orchestration.md`
- Protocol: `docs/agent_protocol.md`
- Coordination: `docs/AGENT_SYNC.md`
- n8n-as-code: `docs/AGENTS.md`
- Implementation: one workflow file from `apps/workflows/local_5678_igor_g/personal/`
- Contracts: `packages/shared/src/schemas.ts`, `/api/internal/agent-completion` contract in `apps/api/src/routes/callback.ts`
- Exclude: unrelated scenario workflow implementations.

## Knowledge And RAG
- Spec: `specs/knowledge-rag.md`
- Implementation: `apps/api/src/routes/knowledge.ts`, `packages/ai-engine/src/rag.ts`, `packages/ai-engine/src/embeddings.ts`
- Contracts: `packages/shared/src/schemas.ts`, `packages/shared/src/types.ts`
- Budget fields: `maxCharsPerChunk`, `maxTotalChars`, `minSimilarity`
- Exclude: agent prompt implementations unless prompt formatting changes.

## Token Monitoring
- Spec: `specs/token-monitoring.md`
- Implementation: `packages/ai-engine/src/token-monitor.ts`, `packages/ai-engine/src/token-budgets.ts`, `packages/ai-engine/src/claude.ts`, `packages/ai-engine/src/embeddings.ts`
- Contracts: `.env.example`, `docs/ENV_SETUP.md`, Prometheus `/metrics`
- Exclude: workflow internals unless provider call routing changes.

## Auth, Projects, Profile
- Spec: `specs/auth-projects-profile.md`
- Implementation: `apps/api/src/routes/auth.ts`, `apps/api/src/routes/projects.ts`, `apps/api/src/routes/profile.ts`
- Contracts: `packages/shared/src/schemas.ts`, `packages/shared/src/types.ts`
- Exclude: AI engine and workflow files unless project profile payload changes.

## Frontend
- Spec: relevant feature spec first.
- Implementation: `apps/frontend/` when present.
- Contracts: API schemas in `packages/shared/src`.
- Exclude: backend implementations unless API behavior changes.
