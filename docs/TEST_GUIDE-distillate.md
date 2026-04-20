---
type: bmad-distillate
sources:
  - "TEST_GUIDE.md"
  - "../specs/README.md"
  - "../specs/agent-orchestration.md"
  - "../specs/auth-projects-profile.md"
  - "../specs/knowledge-rag.md"
  - "../specs/task-lifecycle.md"
  - "../specs/token-monitoring.md"
downstream_consumer: "integration test implementation"
created: "2026-04-20"
token_estimate: 3912
parts: 1
---

## Testing Workflow
- `specs/` = primary source of requirements; `docs/TEST_GUIDE.md` = compact testing reference for Fastify, n8n workflows, and AI logic.
- Before any test task: pick relevant `specs/*.md`; select minimal implementation context through `docs/context_map.md`; clarify/create spec if missing; clarify ambiguous requirements before coding.
- After edits: run checks from nearest `package.json`; use Python `pytest` only for touched Python scripts/tests.
- If dependencies/checks are unavailable: report that fact; do not replace failed/unavailable verification with code reading.
- Integration tests live in `tests/integration/`.
- Test-first rule: specs drive tests before implementation; update spec `last_updated` when changing requirements.
- Token economy: read one feature spec first; then `docs/context_map.md`; read dependency contracts instead of dependency implementation unless changing that dependency.

## Verification Types
- Fastify API: verify statuses, payloads, auth, permission errors; tools/checks include `npm run build` and route tests.
- Zod contracts: verify input/output validation around `packages/shared`.
- n8n workflows: verify routing, callbacks, payload shape; use n8n-as-code validate/test.
- AI engine: verify Claude/Voyage wrappers, token limits, cache fallback; use unit tests with provider mocks.
- RAG: verify `maxCharsPerChunk`, `maxTotalChars`, `minSimilarity`; use unit/API tests with mocked embeddings.
- API/shared contracts: start from Zod schemas.
- Claude/Voyage tests: provider mocks required for reproducibility and token economy.
- Workflow tests: change one scenario file at a time; verify callback payloads.
- Debugging: API failure starts with route schema and shared types; workflow failure compares payload with `specs/agent-orchestration.md` and `docs/agent_protocol.md`; external AI bug gets mocked provider response and repeatable test.
- Documented run commands: `cd apps/api && npm run build`; `cd packages/shared && npx tsc --noEmit`; `pytest -v`.

## Spec Inventory
- `auth-projects-profile.md`: approved high-priority contract for registration, login, projects, project profile; updated 2026-04-10.
- `task-lifecycle.md`: approved high-priority contract for task creation, scoring, statuses, execution launch; updated 2026-04-10.
- `agent-orchestration.md`: approved high-priority contract for n8n scenarios A/B/C/D, callbacks, handoffs; updated 2026-04-11.
- `knowledge-rag.md`: approved high-priority contract for Knowledge DB, embeddings, RAG search, Redis embedding cache; updated 2026-04-11.
- `token-monitoring.md`: approved high-priority contract for Claude/Voyage token accounting, Redis counters, limits, Prometheus; updated 2026-04-11.

## Auth/Project/Profile Test Contract
- Scope files: `apps/api/src/routes/auth.ts`; `apps/api/src/routes/projects.ts`; `apps/api/src/routes/profile.ts`; `packages/shared/src/schemas.ts`; `packages/shared/src/types.ts`; `packages/db/prisma/schema.prisma`.
- Route roots: auth `/api/auth`; projects `/api/projects`; project profile `/api/projects/:projectId/profile`.
- Request validation must use Zod schemas from `packages/shared/src/schemas.ts`.
- Registration accepts `email`, `password`, optional `name`.
- Login returns an access token.
- Authenticated user can create/list only own projects.
- Project access must check membership before returning or mutating project-scoped data.
- Unauthorized/non-member access returns auth/permission error and never leaks project data.
- Project-scoped DB work touching RLS-protected tables must use `withProjectContext(projectId, userId, ...)`.
- Project profile required Tier 1 fields: `companyName`, `description`, `niche`, `geography`.
- Project profile optional fields: products, audience, competitors, TOV, keywords, forbidden topics, references, social links, KPI, existing content.
- Test example register payload: `{ "email": "owner@example.com", "password": "password123", "name": "Owner" }`.
- Test example project settings: `{ "language": "ru", "defaultScenario": "B" }`.
- Test example audience item: segment `SMB founders`; portrait `Owners of 10-100 employee companies`; pain points `manual reporting`, `low funnel visibility`.
- Minimal test context: changed route file plus shared schemas/types and relevant Prisma models; do not include agent workflow implementation unless changing project profile handoff to agents.

## Task Lifecycle Test Contract
- Scope files: `apps/api/src/routes/tasks.ts`; `apps/api/src/services/scoring.ts`; `packages/shared/src/schemas.ts`; `packages/shared/src/enums.ts`; `packages/db/prisma/schema.prisma`.
- Route root: `/api/projects/:projectId/tasks`.
- Create task accepts `{ "input": string }`.
- `input` validation boundary: minimum 10 characters; maximum 5000 characters.
- Scoring result contract: `score`, `scenario`, `reasoning`, `isValid`, optional `clarificationQuestions`.
- Execution threshold: `TASK_SCORE_THRESHOLD = 25`.
- Scenario meanings: `A` one agent; `B` Marketer then Content Maker; `C` independent parallel subtasks; `D` iterative refinement with Evaluator.
- Score below 25: task stored as `REJECTED`; rejected task cannot execute.
- Valid task: stored with scenario and initial status.
- `POST /:taskId/execute`: creates execution and calls n8n orchestrator webhook.
- Concurrent execution guard: running task cannot be executed again.
- SSE stream emits task-scoped events without exposing other project data.
- Scoring Claude calls must go through `@ai-marketing/ai-engine` so token monitoring and limits apply.
- Test example input: `Разработай SMM-кампанию для запуска B2B SaaS продукта в Telegram и LinkedIn`.
- Test example scoring result: `score: 72`; `scenario: "B"`; `reasoning: "Requires strategy before content execution"`; `isValid: true`.
- Minimal test context: `tasks.ts`, `scoring.ts`, shared schemas/enums; workflow files only for execution routing/scenario behavior; `docs/agent_protocol.md` only for handoff changes.

## Agent Orchestration Test Contract
- Scope files: `apps/workflows/local_5678_igor_g/personal/orchestrator.workflow.ts`; scenario A/B/C/D workflow files; `docs/agent_protocol.md`; `docs/tool_protocol.md`.
- Fastify triggers n8n through orchestrator webhook.
- Orchestrator payload fields: `executionId`, `taskId`, `projectId`, `input`, `scenario`, `callbackUrl`, optional `projectProfile`.
- n8n step callback route: `/api/internal/callback`.
- n8n final completion route: `/api/internal/execution-complete`.
- Workflow Claude calls must use `POST /api/internal/agent-completion`; direct `api.anthropic.com` calls are forbidden because they bypass token monitoring.
- Agent handoff uses strict JSON from `docs/agent_protocol.md`; `marketer -> content_maker` must parse via `JSON.parse`.
- Tool usage follows `docs/tool_protocol.md`.
- Scenario A: run one selected agent and return its output.
- Scenario B: run Marketer; retrieve RAG once; build compact prompt pack; pass compact brief/digest plus prompt pack to Content Maker.
- Scenario C: run Marketer and Content Maker independently; merge outputs.
- Scenario D: run Marketer, Content Maker, Evaluator; repeat only if evaluation fails, iteration count below 3, and evaluator feedback is actionable.
- Scenario D max iterations: 3.
- Scenario D revision context: delta-only; brief digest, current draft, evaluator feedback; no repeated full RAG or full marketer handoff.
- Scenario D long-output evaluator input: compact relevant content fragment, not entire deliverable.
- Scenario D skips revision when evaluator feedback is empty or too generic.
- Every workflow callback includes `executionId`, `agentType`, `output`, `iteration`, `status`.
- Scenario B/D fail fast when marketer handoff is not valid `strategy_to_content` JSON.
- Workflows stop on monitored completion errors, including `TOKEN_LIMIT_EXCEEDED`.
- RAG context fetched through Fastify knowledge API; direct n8n DB access for RAG forbidden.
- Compact `ragPromptPack` produced by knowledge API/shared helper; workflows reuse it rather than assembling separately.
- Scenario B/D fetch RAG once per execution and reuse compact `ragPromptPack`.
- Workflow files edited through n8n-as-code process in `docs/AGENTS.md`.
- Test example agent completion payload fields: `systemPrompt`, `userMessage`, `maxTokens: 2400`, `operation: "scenario-b.marketer"`.
- Minimal workflow test context: read `<workflow-map>` if present; include `docs/agent_protocol.md` and only changed scenario workflow; unrelated scenarios only for shared orchestrator behavior changes.

## Knowledge/RAG Test Contract
- Scope files: `apps/api/src/routes/knowledge.ts`; `packages/ai-engine/src/embeddings.ts`; `packages/ai-engine/src/rag.ts`; `packages/shared/src/schemas.ts`; `packages/db/prisma/schema.prisma`; `packages/db/migrations/001_rls_policies.sql`.
- Route root: `/api/projects/:projectId/knowledge`.
- Create knowledge item accepts `category`, `content`, optional `metadata`.
- Search route: `GET /api/projects/:projectId/knowledge/search?q=...&category=...&limit=...`.
- Search returns raw `data` plus compact `shortlist` and `promptPack`.
- Search returns only project-scoped items, ordered by vector similarity.
- Search applies RAG budget before prompt context return: `maxCharsPerChunk`, `maxTotalChars`, `minSimilarity`.
- `promptPack` must be built by shared helper in `packages/ai-engine`, not duplicated in workflows.
- Multi-step executions retrieve RAG once per execution; later agent steps reuse compact prompt pack.
- Embeddings use Voyage `voyage-3-lite` and pgvector dimension 1024.
- Redis embedding cache checked before Voyage call.
- Knowledge item creation stores content even when async embedding fails.
- Embedding failures logged as warnings; original knowledge item not lost.
- Search never returns data from another project.
- Search `limit` capped by Zod validation.
- Voyage calls go through `packages/ai-engine/src/embeddings.ts` so token monitoring, Redis counters, and token limits apply.
- RAG formatting sends only relevant snippets to prompts.
- RAG budget assertions: snippets below `minSimilarity` excluded; each snippet trimmed to `maxCharsPerChunk`; final context never exceeds `maxTotalChars`.
- Two-stage RAG: retrieval shortlist first; lightweight prompt pack with 2-3 compact theses second.
- Scenario B/D do not issue duplicate `knowledge/search` requests for same `executionId` and `input`.
- Test example create item fields: `category: "CASE"`; `content: "Case study: Telegram launch campaign..."`; metadata `title`, `source`, `tags`.
- Minimal RAG test context: `embeddings.ts`, `rag.ts`, `knowledge.ts`, shared schemas, Prisma `KnowledgeItem`; exclude agent prompts unless changing prompt insertion.

## Token Monitoring Test Contract
- Scope files: `packages/ai-engine/src/token-monitor.ts`; `packages/ai-engine/src/redis.ts`; `packages/ai-engine/src/claude.ts`; `packages/ai-engine/src/embeddings.ts`; `apps/api/src/app.ts`; `apps/api/src/routes/callback.ts`; `docs/ARCHITECTURE.md`; `.env.example`.
- Redis provider counters: `tokens_used:claude`, `tokens_used:voyage`, `token_fallbacks:claude`, `token_fallbacks:voyage`.
- Redis per-agent-step telemetry keys: `agent_step_telemetry`, `agent_step_telemetry:{taskId}`.
- `GET /metrics` exposes Prometheus text metrics.
- `/metrics` exposes provider-level metrics and operation-level token counters.
- Claude calls use Anthropic API response usage.
- Voyage calls use Voyage response usage when available; otherwise local token estimate.
- Runtime limits configured by `CLAUDE_TOKEN_LIMIT`, `VOYAGE_TOKEN_LIMIT`; `0` disables enforcement for a provider.
- Cost estimates use `CLAUDE_INPUT_COST_PER_MTOKENS`, `CLAUDE_OUTPUT_COST_PER_MTOKENS`.
- Claude output budgets: `MAX_TOKENS_SCORING` default 512 target 300-600; `MAX_TOKENS_EVALUATOR_JSON` default 1024 target 800-1500; `MAX_TOKENS_MARKETER_BRIEF` default 2400 target 1500-3000; `MAX_TOKENS_CONTENT_GENERATION` default 4096 tuned by deliverable; `MAX_TOKENS_REVISION_DELTA` default 1500 target 800-2000.
- Revision gate: `MIN_REVISION_FEEDBACK_CHARS` default 40; Scenario D starts another revision only when evaluator feedback is actionable.
- `runAgent` and `runAgentStreaming` record Claude usage.
- `embedText` and `embedBatch` record Voyage usage.
- Claude checks token budget before provider calls and falls back to cached response for same prompt when available.
- Voyage checks Redis embedding cache before provider calls and refuses uncached calls when limit exceeded.
- n8n workflows call `/api/internal/agent-completion` instead of Anthropic directly.
- Every agent step logs `taskId`, `scenario`, input tokens, output tokens, RAG chars/tokens, model, latency, cost estimate.
- Scoring, evaluator JSON, marketer brief, content generation, and revision calls use separate `maxTokens` budgets.
- Evaluator operations use compact content fragment instead of full deliverable when deliverable is long.
- Prometheus scrape/alert thresholds: 80%, 90%, 100% of configured limits.
- Operation-level metric for costly operations: `ai_tokens_used_by_operation_total{provider,operation}`; example operations `scenario-d.revision`, `task.scoring`, `scenario-b.marketer`.
- Example metrics: `ai_tokens_used_total{provider="claude"}`; `ai_tokens_used_total{provider="voyage"}`; `ai_token_limit{provider="claude"}`; `ai_token_fallbacks_total{provider="claude"}`; `ai_token_cost_estimate_usd_total{provider="claude"}`.
- Minimal token test context: this spec for Claude/Voyage calls, Redis token counters, `/metrics`, n8n agent completion routing; workflow internals only when provider call routing changes from n8n.

## Cross-Cutting Integration Test Matrix
- Isolation: project/profile membership checks; task SSE task-scoped events; knowledge search project scope; RAG no cross-project data.
- Validation boundaries: auth schemas; project/profile schemas; task input 9/10/5000/5001 characters; knowledge search `limit` cap.
- State guards: rejected task cannot execute; running task cannot execute concurrently; valid task creates execution; score below 25 stores `REJECTED`.
- Provider centralization: task scoring uses `@ai-marketing/ai-engine`; workflow Claude uses `/api/internal/agent-completion`; Voyage uses `embeddings.ts`.
- AI mocks: mock Claude/Voyage for all unit tests; assert usage accounting and fallback behavior without real provider calls.
- RAG budgets: assert `minSimilarity` filter, chunk trim, total context cap, promptPack existence, 2-3 compact theses, duplicate-search prevention for same `executionId`+`input`.
- Workflow callbacks: assert required callback fields; final completion route; invalid marketer JSON fail-fast; token limit error stop; Scenario D iteration ceiling and actionable-feedback gate.
- Metrics: assert provider totals, operation labels, provider limits, fallback counters, cost estimate metrics, Prometheus text format.
- Error paths: auth/permission denial; non-member access; invalid Zod payloads; embedding async failure; provider budget exceeded; token fallback; workflow monitored completion failure.
- Context discipline: tests should load changed route/spec and direct contracts; avoid unrelated workflow/scenario/prompt files unless behavior crosses that boundary.
