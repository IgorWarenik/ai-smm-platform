---
type: bmad-distillate
sources:
  - "ARCHITECTURE.md"
  - "context_map.md"
downstream_consumer: "implementation planning"
created: "2026-04-20"
token_estimate: 3021
parts: 1
---

## System Shape
- Client layer: web browser calls Fastify API.
- API gateway: `apps/api` Fastify Node.js service; async HTTP API; TypeScript monorepo; native SSE; shared types with frontend.
- AI orchestration layer: `apps/workflows`; n8n workflow engine; scenarios stored as version-controlled TypeScript files.
- AI agents: Marketer, Content Maker, Evaluator.
- AI services: selected model provider (Claude, DeepSeek, ChatGPT/OpenAI, or Gemini) for generation and evaluation; Voyage AI embeddings for semantic search.
- Data layer: PostgreSQL 16 + pgvector; Redis cache and n8n queue backend; MinIO object storage.
- Primary flow: client -> Fastify -> n8n -> scenario workflow -> agents -> selected model provider; Fastify also talks to Voyage, PostgreSQL, Redis, MinIO.
- Frontend target: Next.js 14 App Router; Tailwind CSS; TypeScript; handles auth, project management, task creation, SSE progress, approval flows.

## Module Boundaries
- Modules interact through public contracts: interfaces, TypeScript types, Zod schemas, explicit DTOs.
- Implementation planning rule: when changing a module, load that module implementation plus dependent module contracts only (`*.interface.ts`, `types.ts`, Zod schemas).
- Encapsulation goal: reduce context use and avoid unrequested changes to dependent module internals.
- Always-read context: `specs/README.md`; relevant `specs/*.md`; `docs/CONTEXT.md`; add `docs/agent_protocol.md` only when agent handoff changes.

## API Gateway
- Fastify routes: `/api/auth`, `/api/projects`, `/api/projects/:id/profile`, `/api/projects/:id/tasks`, `/api/projects/:id/tasks/:id/approvals`, `/api/projects/:id/tasks/:id/feedback`, `/api/projects/:id/knowledge`, `/api/projects/:id/model-config`, `/api/internal/agent-completion`, `/api/internal/callback`, `/api/internal/execution-complete`.
- Request validation: Zod on all inputs.
- Auth: JWT access + refresh tokens.
- Authorization: role-based; `PlatformRole` values SUPER_ADMIN, MANAGER, USER; `MemberRole` values OWNER, MEMBER, VIEWER.
- Real-time progress: Server-Sent Events; long-lived connections managed in-process with `Map<taskId, senderFn>`.
- Internal callbacks: `/api/internal/*` requires `INTERNAL_API_TOKEN` header.
- Secrets: environment variables only; never commit secrets.
- API security: Zod validation, JWT auth, role checks, Fastify rate limiting.

## Task Lifecycle
- Lifecycle: `QUEUED -> background scoring -> REJECTED | AWAITING_CLARIFICATION | PENDING`.
- Lifecycle: `PENDING -> RUNNING -> AWAITING_APPROVAL`.
- Approval outcomes from `AWAITING_APPROVAL`: `COMPLETED`; `REVISION_REQUESTED` returns task to `QUEUED` until revision cap, then stays `AWAITING_APPROVAL` with manager review required; `REJECTED`.
- Task creation flow: user posts task input; Fastify stores task as `QUEUED`; background scoring then updates task state and may trigger execution.
- Execution flow: user posts execute; Fastify loads project profile; Fastify triggers n8n orchestrator webhook with payload plus profile; n8n runs workflow; callbacks store outputs and drive SSE.
- Completion flow: n8n posts `/internal/execution-complete`; Fastify updates task toward approval state; user posts approval decision; Fastify updates final task status.

## Orchestration
- Scenario A: direct API-driven single-agent execution path.
- Scenario B: sequential Marketer -> Content Maker; strict JSON handoff defined in `docs/agent_protocol.md`.
- Scenario C: Marketer and Content Maker run in parallel; results merged.
- Scenario D: Marketer -> Content Maker -> Evaluator loop; max 3 iterations; manager escalation/approval path after iteration cap per ТЗ §11.4.
- n8n callbacks: each agent step posts to Fastify `/api/internal/callback`.
- n8n finalization: workflow posts to Fastify `/api/internal/execution-complete`.
- Agent tools: RAG search and knowledge base access are called from n8n Code nodes via HTTP APIs, not direct DB access.
- Agent errors: caught in n8n and reported back through callback.
- Workflow provider rule: n8n must call `POST /api/internal/agent-completion`; direct provider API calls bypass token counters/limits and are forbidden.

## AI And RAG
- Model provider is selected at runtime from project/profile settings and env-backed config.
- Voyage embeddings: 1024 dimensions; stored in pgvector.
- Redis embedding cache: repeated Voyage vectors and token savings.
- RAG search: PostgreSQL pgvector with HNSW index for approximate nearest-neighbor lookup.
- RAG budget before prompt injection: trim with `maxCharsPerChunk`, `maxTotalChars`, `minSimilarity`.
- RAG access boundary: n8n uses Fastify knowledge API; direct n8n database RAG access violates architecture.
- AI provider boundary for token monitoring: `packages/ai-engine`.

## Data And Multi-Tenancy
- PostgreSQL 16 stores project profiles, tasks, knowledge items, files, and related domain data.
- pgvector powers vector similarity search for RAG.
- Redis stores session/cache data and n8n queue execution backend (`EXECUTIONS_MODE=queue`).
- MinIO stores brand assets, task uploads, generated outputs.
- Multi-tenant isolation: PostgreSQL RLS policies keyed by `project_id`.
- Project-scoped entities isolated by `project_id`: `project_profiles`, `tasks`, `knowledge_items`, `files`.
- Shared/global entities: `KnowledgeCategory.FRAMEWORK`; agent prompts.
- Design decision: PostgreSQL RLS chosen for row-level isolation instead of application-layer-only filtering.

## Deployment
- Docker Compose stack: Fastify API, Next.js frontend, n8n Workflow Engine, PostgreSQL 16 + pgvector, Redis, MinIO.
- External services: selected model provider API; Voyage AI.
- Service edges: API -> PostgreSQL/Redis/MinIO/n8n/model-provider/Voyage; frontend -> API; n8n -> API; direct n8n -> provider calls are constrained by token-monitoring rules to go through API.

## Key Decisions
- API runtime: Node.js + Fastify; reason: TypeScript monorepo, native SSE, shared frontend/backend types.
- Orchestration: n8n rather than CrewAI/LangChain; reason: visual debugging, webhook-native execution, version-controlled as code.
- Agent intelligence: provider calls are centralized through shared provider routing and `/api/internal/agent-completion` for workflow-driven steps.
- Queue backend: Redis + n8n queue mode; reason: avoids Celery/Python dependency.
- File storage: MinIO; reason: S3-compatible, self-hosted, Docker-friendly.
- Embeddings: Voyage AI 1024-dim; reason: Russian-language semantic search quality.
- Multi-tenancy: PostgreSQL RLS; reason: row-level isolation without relying only on application filters.

## Performance
- Fastify routes are async; Prisma uses database connection pooling.
- SSE long-lived connections held in in-process task sender registry; implementation plans touching horizontal API scaling must account for this.
- pgvector HNSW index supports fast approximate nearest-neighbor lookup.
- n8n queue mode uses Redis-backed execution queue for horizontal n8n worker scaling.
- Redis cache also used for session tokens and frequently-read project profiles.
- RAG budget controls prompt size before injection, not after provider call.

## Token Monitoring
- Claude usage: read from Anthropic API responses; increment Redis counter `tokens_used:claude`.
- Voyage usage: read from Voyage response when available; otherwise local text-token estimate; increment `tokens_used:voyage`.
- Fallback counters: `token_fallbacks:claude`, `token_fallbacks:voyage`.
- Agent telemetry stores to `agent_step_telemetry` and `agent_step_telemetry:{taskId}`.
- Telemetry fields: `taskId`, `scenario`, input tokens, output tokens, RAG chars/tokens, model, latency, cost estimate.
- Metrics endpoint: Fastify `GET /metrics`; Prometheus text format.
- Metrics exposed: `ai_tokens_used_total{provider="claude|voyage"}`; `ai_tokens_used_by_operation_total{provider="claude|voyage",operation="..."}`; `ai_token_limit{provider="claude|voyage"}`; `ai_token_fallbacks_total{provider="claude|voyage"}`; `ai_token_cost_estimate_usd_total{provider="claude|voyage"}`.
- Runtime limits: `CLAUDE_TOKEN_LIMIT`, `VOYAGE_TOKEN_LIMIT`; `0` disables enforcement for that provider.
- Cost settings: `CLAUDE_INPUT_COST_PER_MTOKENS`, `CLAUDE_OUTPUT_COST_PER_MTOKENS`.
- Claude budget envs: `MAX_TOKENS_SCORING` default 512 target 300-600; `MAX_TOKENS_EVALUATOR_JSON` default 1024 target 800-1500; `MAX_TOKENS_MARKETER_BRIEF` default 2400 target 1500-3000; `MAX_TOKENS_CONTENT_GENERATION` default 4096 tuned by deliverable; `MAX_TOKENS_REVISION_DELTA` default 1500 target 800-2000.
- Limit behavior: when provider limit would be exceeded, agents stop new provider calls.
- Claude fallback: cached response for same prompt when available.
- Voyage fallback: embedding cache checked first; uncached calls refused after limit reached.
- Prometheus alerts: scrape `/metrics`; alert when `ai_tokens_used_total / ai_token_limit` crosses 80%, 90%, 100%.
- Dashboard grouping: `ai_tokens_used_by_operation_total` by `operation` for expensive flows including `scenario-b.marketer`, `scenario-d.content_maker`, `scenario-d.evaluator`, `task.scoring`.

## Implementation Context Map
- API and tasks: spec `specs/task-lifecycle.md`; implementation `apps/api/src/routes/tasks.ts`, `apps/api/src/routes/callback.ts`; contracts `packages/shared/src/schemas.ts`, `packages/shared/src/types.ts`; exclude Prisma generated output and unrelated route files unless changing DB internals.
- Agent orchestration: spec `specs/agent-orchestration.md`; protocol `docs/agent_protocol.md`; implementation one workflow file from `apps/workflows/local_5678_igor_g/personal/`; contracts `packages/shared/src/schemas.ts` and `/api/internal/agent-completion` contract in `apps/api/src/routes/callback.ts`; exclude unrelated scenarios.
- Knowledge and RAG: spec `specs/knowledge-rag.md`; implementation `apps/api/src/routes/knowledge.ts`, `packages/ai-engine/src/rag.ts`, `packages/ai-engine/src/embeddings.ts`; contracts `packages/shared/src/schemas.ts`, `packages/shared/src/types.ts`; budget fields `maxCharsPerChunk`, `maxTotalChars`, `minSimilarity`; exclude agent prompts unless prompt formatting changes.
- Token monitoring: spec `specs/token-monitoring.md`; implementation `packages/ai-engine/src/token-monitor.ts`, `packages/ai-engine/src/token-budgets.ts`, `packages/ai-engine/src/claude.ts`, `packages/ai-engine/src/embeddings.ts`; contracts `.env.example`, `docs/ENV_SETUP.md`, Prometheus `/metrics`; exclude workflow internals unless provider call routing changes.
- Auth/projects/profile: spec `specs/auth-projects-profile.md`; implementation `apps/api/src/routes/auth.ts`, `apps/api/src/routes/projects.ts`, `apps/api/src/routes/profile.ts`; contracts `packages/shared/src/schemas.ts`, `packages/shared/src/types.ts`; exclude AI engine/workflow files unless project profile payload changes.
- Frontend: spec relevant feature first; implementation `apps/frontend/` when present; contracts API schemas in `packages/shared/src`; exclude backend implementations unless API behavior changes.

## Implementation Planning Invariants
- Start from spec and context map; keep edits scoped to the selected feature block.
- Preserve module encapsulation: read/change implementation only where behavior changes; read dependent contracts elsewhere.
- Preserve multi-tenant isolation: every project-scoped path must respect membership and `project_id`/RLS boundaries.
- Preserve provider centralization: Claude/Voyage usage must be measurable through `packages/ai-engine` or API callback boundary; no direct unmonitored provider calls.
- Preserve workflow observability: every n8n step outcome must callback through Fastify so DB state and SSE stream stay synchronized.
- Preserve token/runtime limits: new AI calls need operation labels, per-call budgets, usage accounting, fallback/limit behavior, and metrics visibility.
- Preserve RAG budget and API boundary: workflows consume compact knowledge via Fastify/shared helpers; prompt context stays filtered and bounded.
