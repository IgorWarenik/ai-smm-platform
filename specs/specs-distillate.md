---
type: bmad-distillate
sources:
  - "README.md"
  - "agent-orchestration.md"
  - "auth-projects-profile.md"
  - "knowledge-rag.md"
  - "task-lifecycle.md"
  - "token-monitoring.md"
downstream_consumer: "test planning"
created: "2026-04-20"
token_estimate: 3767
parts: 1
---

## Spec Workflow Contract
- `specs/` = primary implementation contract; every feature must be specified before development.
- `specs/` + `docs/TEST_GUIDE.md` = testing contract; tests are written before implementation.
- Work sequence: find relevant `specs/*.md`; open `docs/context_map.md`; select minimal implementation files; create/clarify spec if missing; clarify ambiguity before coding; update `last_updated` when requirements change.
- Required spec format: `title`, `status` (`draft`/`approved`), `priority` (`high`/`medium`/`low`), `last_updated` (`YYYY-MM-DD`), `scope`, `acceptance_criteria`, `examples`.
- Token economy rule: use one relevant spec first, then `docs/context_map.md`; avoid broad `docs/ARCHITECTURE.md`/`docs/CLAUDE.md` context unless needed; reference `specs/` and `docs/TEST_GUIDE.md`.

## Spec Index
- `auth-projects-profile.md`: registration, login, projects, project profile; status approved; priority high; last updated 2026-04-10.
- `task-lifecycle.md`: task creation, scoring, statuses, execution launch; status approved; priority high; last updated 2026-04-10.
- `agent-orchestration.md`: n8n scenarios A/B/C/D, callbacks, agent handoff; status approved; priority high; last updated 2026-04-11.
- `knowledge-rag.md`: Knowledge DB, embeddings, RAG search, Redis embedding cache; status approved; priority high; last updated 2026-04-11.
- `token-monitoring.md`: Claude/Voyage token accounting, Redis counters, limits, Prometheus; status approved; priority high; last updated 2026-04-11.

## Auth, Projects, Profile
- Scope: `apps/api/src/routes/auth.ts`; `apps/api/src/routes/projects.ts`; `apps/api/src/routes/profile.ts`; `packages/shared/src/schemas.ts`; `packages/shared/src/types.ts`; `packages/db/prisma/schema.prisma`.
- Goal: secure account, isolated projects, compact project profile usable as agent business context.
- Routes: auth under `/api/auth`; projects under `/api/projects`; project profile under `/api/projects/:projectId/profile`.
- Validation: requests use Zod schemas from `packages/shared/src/schemas.ts`.
- Access control: project access checks membership before returning/mutating project-scoped data; unauthorized/non-member access returns auth/permission error and never leaks project data.
- RLS contract: project-scoped database work touching RLS-protected tables runs through `withProjectContext(projectId, userId, ...)`.
- Register accepts `email`, `password`, optional `name`; login returns access token.
- Authenticated users can create/list only their own projects.
- Project profile required Tier 1 fields: `companyName`, `description`, `niche`, `geography`.
- Project profile optional fields: products, audience, competitors, TOV, keywords, forbidden topics, references, social links, KPI, existing content.
- Example register: `{ "email": "owner@example.com", "password": "password123", "name": "Owner" }`.
- Example project settings: `{ "language": "ru", "defaultScenario": "B" }`.
- Example profile audience item: segment `SMB founders`; portrait `Owners of 10-100 employee companies`; pain points `manual reporting`, `low funnel visibility`.
- Test context rule: include route file under change plus shared schemas/types and relevant Prisma models; exclude agent workflow implementation unless changing profile handoff to agents.

## Task Lifecycle And Scoring
- Scope: `apps/api/src/routes/tasks.ts`; `apps/api/src/services/scoring.ts`; `packages/shared/src/schemas.ts`; `packages/shared/src/enums.ts`; `packages/db/prisma/schema.prisma`.
- Goal: accept marketing tasks only with enough context; classify into scenarios; move through predictable lifecycle.
- Routes: task routes live under `/api/projects/:projectId/tasks`.
- Create task accepts `{ "input": string }`; `input` length must be 10-5000 characters.
- Scoring returns `score`, `scenario`, `reasoning`, `isValid`, optional `clarificationQuestions`.
- Execution threshold: `TASK_SCORE_THRESHOLD = 25`.
- Scenario `A`: one agent; scenario `B`: Marketer then Content Maker; scenario `C`: independent parallel subtasks; scenario `D`: iterative refinement with Evaluator.
- Score below 25: task stored as `REJECTED`; rejected task cannot execute.
- Valid task: stored with scenario and initial status.
- `POST /:taskId/execute`: creates execution and calls n8n orchestrator webhook.
- Concurrency: running tasks cannot execute again concurrently.
- SSE stream: emits task-scoped events without exposing other project data.
- Scoring Claude calls must go through `@ai-marketing/ai-engine` so token monitoring and limits apply.
- Example task input: `Разработай SMM-кампанию для запуска B2B SaaS продукта в Telegram и LinkedIn`.
- Example scoring result: score `72`; scenario `B`; reasoning `Requires strategy before content execution`; `isValid: true`.
- Test context rule: include `tasks.ts`, `scoring.ts`, shared schemas/enums; include workflow files only for execution routing/scenario behavior; include `docs/agent_protocol.md` only for agent handoff changes.

## Agent Orchestration
- Scope: `apps/workflows/local_5678_igor_g/personal/orchestrator.workflow.ts`; scenario A/B/C/D workflow files; `docs/agent_protocol.md`; `docs/tool_protocol.md`.
- Goal: run correct agent workflow for each accepted task while keeping handoffs compact, observable, and token-bounded.
- Fastify triggers n8n via orchestrator webhook.
- n8n receives `executionId`, `taskId`, `projectId`, `input`, `scenario`, `callbackUrl`, optional `projectProfile`.
- n8n sends step results to `/api/internal/callback`; sends final completion to `/api/internal/execution-complete`.
- Claude workflow completions must use `POST /api/internal/agent-completion`; direct `api.anthropic.com` calls bypass token monitoring and are forbidden.
- Agent handoff uses strict JSON from `docs/agent_protocol.md`; `marketer -> content_maker` must be parseable by `JSON.parse`.
- Tool usage follows `docs/tool_protocol.md`.
- Scenario A: run one selected agent and return output.
- Scenario B: run Marketer; retrieve RAG once; build compact prompt pack; pass compact brief/digest plus prompt pack to Content Maker.
- Scenario C: run Marketer and Content Maker as independent branches; merge outputs.
- Scenario D: run Marketer, Content Maker, Evaluator; repeat only when evaluation fails, iteration count below 3, and evaluator feedback is actionable; revisions use delta-only context.
- Scenario D max iterations: never exceeds 3.
- Scenario D long output handling: evaluator reviews compact content fragment, not entire deliverable.
- Every workflow callback includes `executionId`, `agentType`, `output`, `iteration`, `status`.
- Scenario B/D fail fast when marketer handoff is not valid `strategy_to_content` JSON.
- Workflows stop on monitored completion errors including `TOKEN_LIMIT_EXCEEDED`.
- RAG context is fetched through Fastify knowledge API, never direct DB access from n8n.
- Compact `ragPromptPack` is produced by knowledge API/shared helper and reused by workflows, not assembled separately per workflow.
- Scenario B/D fetch RAG once per execution and reuse compact `ragPromptPack`; Scenario D revisions do not repeat full RAG or full marketer handoff.
- Scenario D revision context: brief digest, current draft, evaluator feedback only.
- Scenario D skips extra revision iterations when evaluator feedback is empty or too generic to justify another Claude call.
- Workflow files are edited through n8n-as-code process in `docs/AGENTS.md`.
- Example orchestrator payload fields: `executionId`, `taskId`, `projectId`, `input`, `scenario`, `callbackUrl`.
- Example agent completion fields: `systemPrompt`, `userMessage`, `maxTokens: 2400`, `operation: "scenario-b.marketer"`.
- Test context rule: for workflow changes, read `<workflow-map>` when present; include `docs/agent_protocol.md` and only changed scenario workflow; exclude unrelated scenarios unless shared orchestrator behavior changes.

## Knowledge Base And RAG
- Scope: `apps/api/src/routes/knowledge.ts`; `packages/ai-engine/src/embeddings.ts`; `packages/ai-engine/src/rag.ts`; `packages/shared/src/schemas.ts`; `packages/db/prisma/schema.prisma`; `packages/db/migrations/001_rls_policies.sql`.
- Goal: store project knowledge, embed with Voyage AI, retrieve compact relevant agent context without cross-project leaks.
- Routes: knowledge routes under `/api/projects/:projectId/knowledge`.
- Create knowledge item accepts `category`, `content`, optional `metadata`.
- Search endpoint: `GET /api/projects/:projectId/knowledge/search?q=...&category=...&limit=...`.
- Search returns raw `data` plus compact `shortlist` and `promptPack`.
- Search returns project-scoped items ordered by vector similarity.
- Search applies RAG budget before prompt context return: `maxCharsPerChunk`, `maxTotalChars`, `minSimilarity`.
- `promptPack` built by shared helper in `packages/ai-engine`, not duplicated in workflows.
- Multi-step executions retrieve RAG once per execution; later agent steps reuse compact prompt pack instead of repeating search.
- Embeddings use Voyage `voyage-3-lite` and pgvector dimension 1024.
- Redis embedding cache checked before Voyage call.
- Knowledge item creation stores content even if async embedding fails.
- Embedding failures are logged as warnings and do not lose original knowledge item.
- Search never returns data from another project.
- Search limit is capped by Zod validation.
- Voyage calls go through `packages/ai-engine/src/embeddings.ts` so token monitoring, Redis counters, and token limits apply.
- RAG formatting sends only relevant knowledge snippets to prompts.
- RAG budget behavior: snippets below `minSimilarity` excluded; each snippet trimmed to `maxCharsPerChunk`; final context never exceeds `maxTotalChars`.
- Two-stage RAG: retrieval shortlist first, then lightweight prompt pack with 2-3 compact theses.
- Scenario B/D do not issue duplicate `knowledge/search` requests for same `executionId` and `input`.
- Example knowledge metadata: `title`, `source`, `tags`.
- Test context rule: for RAG changes, include `embeddings.ts`, `rag.ts`, `knowledge.ts`, shared schemas, Prisma `KnowledgeItem`; exclude agent prompt files unless changing retrieved context insertion into prompts.

## Token Monitoring And Runtime Limits
- Scope: `packages/ai-engine/src/token-monitor.ts`; `packages/ai-engine/src/redis.ts`; `packages/ai-engine/src/claude.ts`; `packages/ai-engine/src/embeddings.ts`; `apps/api/src/app.ts`; `apps/api/src/routes/callback.ts`; `docs/ARCHITECTURE.md`; `.env.example`.
- Goal: make AI token usage visible; enforce runtime limits; prevent unbounded Claude/Voyage calls.
- Redis provider counters: `tokens_used:claude`, `tokens_used:voyage`, `token_fallbacks:claude`, `token_fallbacks:voyage`.
- Redis per-agent-step telemetry keys: `agent_step_telemetry`, `agent_step_telemetry:{taskId}`.
- `GET /metrics` exposes Prometheus text metrics.
- `/metrics` exposes provider-level metrics and operation-level token counters for dashboards/alerts.
- Claude calls use usage from Anthropic API responses.
- Voyage calls use usage from Voyage responses when available, otherwise local token estimate.
- Runtime limits configured with `CLAUDE_TOKEN_LIMIT`, `VOYAGE_TOKEN_LIMIT`; `0` disables enforcement for a provider.
- Cost estimates use `CLAUDE_INPUT_COST_PER_MTOKENS`, `CLAUDE_OUTPUT_COST_PER_MTOKENS`.
- Claude output budgets: `MAX_TOKENS_SCORING` default 512 target 300-600; `MAX_TOKENS_EVALUATOR_JSON` default 1024 target 800-1500; `MAX_TOKENS_MARKETER_BRIEF` default 2400 target 1500-3000; `MAX_TOKENS_CONTENT_GENERATION` default 4096 tuned by deliverable; `MAX_TOKENS_REVISION_DELTA` default 1500 target 800-2000.
- Revision gate: `MIN_REVISION_FEEDBACK_CHARS` default 40; Scenario D starts another revision only when evaluator feedback is actionable.
- `runAgent` and `runAgentStreaming` record Claude usage.
- `embedText` and `embedBatch` record Voyage usage.
- Claude checks token budget before provider calls and falls back to cached response for same prompt when available.
- Voyage checks Redis embedding cache before provider calls and refuses uncached calls when limit exceeded.
- n8n workflows call `/api/internal/agent-completion`, not Anthropic directly.
- Every agent step logs `taskId`, `scenario`, input tokens, output tokens, RAG chars/tokens, model, latency, cost estimate.
- Scoring, evaluator JSON, marketer brief, content generation, revision calls use separate `maxTokens` budgets.
- Evaluator operations use compact content fragment instead of full deliverable when deliverable is long.
- Prometheus can scrape `/metrics` and alert at 80%, 90%, 100% of configured limits.
- Prometheus can chart/alert on `ai_tokens_used_by_operation_total{provider,operation}` for expensive operations such as `scenario-d.revision` or `task.scoring`.
- Example metrics: `ai_tokens_used_total{provider="claude"}`, `ai_tokens_used_total{provider="voyage"}`, `ai_tokens_used_by_operation_total{provider="claude",operation="scenario-b.marketer"}`, `ai_token_limit{provider="claude"}`, `ai_token_fallbacks_total{provider="claude"}`, `ai_token_cost_estimate_usd_total{provider="claude"}`.
- Test context rule: include this spec for Claude/Voyage calls, Redis token counters, `/metrics`, or n8n agent completion routing; exclude workflow internals unless changing provider call routing from n8n.

## Cross-Spec Test Planning Invariants
- Multi-tenant isolation appears in auth/project/profile, task SSE, knowledge search, and RAG; tests should assert non-member access denial and no cross-project data leakage.
- Zod validation boundaries are test-critical: task input length 10-5000; knowledge search `limit` cap; auth/project/profile request schemas.
- AI provider calls must be centralized: scoring via `@ai-marketing/ai-engine`; workflow Claude via `/api/internal/agent-completion`; Voyage via `embeddings.ts`.
- Token monitoring must cover Claude, Voyage, operation labels, per-agent-step telemetry, fallback counters, cost estimates, provider limits, and separate max token budgets.
- RAG must be project-scoped, budget-trimmed, similarity-filtered, prompt-pack-based, cached for embeddings, and reused once per execution in Scenario B/D.
- Scenario D must enforce iteration ceiling, actionable-feedback gate, compact evaluator input, delta-only revision context, and no duplicate full RAG/handoff in revisions.
- Error-path tests must cover auth/permission errors, rejected task execution, concurrent execution conflict, invalid marketer JSON fail-fast, token limit errors, embedding failure persistence, and provider limit refusal.
- n8n workflow tests must verify callback payload shape, monitored completion route usage, no direct DB RAG access, no direct Anthropic calls, and stop behavior on monitored completion errors.
