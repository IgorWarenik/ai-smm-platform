# Work Plan — AI Marketing Platform

> Отмечай `[x]` когда шаг завершён. Читай этот файл в начале каждой сессии.

---

## Этап 1 — Backend Core ✅ ЗАВЕРШЁН

### 1.1 Shared packages
- [x] `packages/shared/src/enums.ts` — TaskStatus, ScenarioType, MemberRole, AgentType, KnowledgeCategory
- [x] `packages/shared/src/types.ts` — TS-типы проекта
- [x] `packages/shared/src/schemas.ts` — Zod-схемы: Register, Login, CreateTask, CreateProject, etc.
- [x] `packages/shared/src/index.ts` — barrel export

### 1.2 Database (Prisma)
- [x] `packages/db/prisma/schema.prisma` — модели: User, Project, ProjectMember, ProjectProfile, Task, Execution, AgentOutput, KnowledgeItem, Billing
- [x] `packages/db/src/client.ts` — Prisma client singleton
- [x] `packages/db/src/rls.ts` — `withProjectContext()` для RLS-изоляции по project_id
- [x] `packages/db/src/seed.ts` — seed-данные
- [x] `packages/db/src/index.ts` — barrel export

### 1.3 AI Engine
- [x] `packages/ai-engine/src/claude.ts` — `runAgent()`, `TokenLimitExceededError`
- [x] `packages/ai-engine/src/embeddings.ts` — `embedText()`, `embedBatch()` через Voyage AI
- [x] `packages/ai-engine/src/rag.ts` — RAG-поиск через pgvector
- [x] `packages/ai-engine/src/rag-budget.ts` — `resolveRagBudget()`, `applyRagBudget()`
- [x] `packages/ai-engine/src/rag-pack.ts` — `buildRagPack()`
- [x] `packages/ai-engine/src/semantic-cache.ts` — Redis semantic cache
- [x] `packages/ai-engine/src/redis.ts` — Redis client
- [x] `packages/ai-engine/src/token-monitor.ts` — мониторинг токенов Claude/Voyage, Prometheus metrics
- [x] `packages/ai-engine/src/token-budgets.ts` — MAX_TOKENS_* константы
- [x] `packages/ai-engine/src/prompts/role-cards.ts` — короткие role cards агентов
- [x] `packages/ai-engine/src/prompts/marketer.ts` — системный промпт маркетолога
- [x] `packages/ai-engine/src/prompts/content-maker.ts` — системный промпт контент-мейкера
- [x] `packages/ai-engine/src/prompts/evaluator.ts` — системный промпт эвалюатора
- [x] `packages/ai-engine/src/index.ts` — barrel export

### 1.4 Fastify API
- [x] `apps/api/src/app.ts` — Fastify app, plugins, route registration
- [x] `apps/api/src/index.ts` — entry point
- [x] `apps/api/src/plugins/jwt.ts` — JWT auth plugin
- [x] `apps/api/src/routes/auth.ts` — register, login, refresh, me
- [x] `apps/api/src/routes/projects.ts` — CRUD проектов, управление участниками
- [x] `apps/api/src/routes/profile.ts` — GET/PUT project profile
- [x] `apps/api/src/routes/tasks.ts` — create, list, get, execute, SSE stream, clarification
- [x] `apps/api/src/routes/approvals.ts` — approve/reject task output
- [x] `apps/api/src/routes/feedback.ts` — revision feedback
- [x] `apps/api/src/routes/knowledge.ts` — CRUD knowledge items, RAG search
- [x] `apps/api/src/routes/callback.ts` — `/internal/agent-completion`, `/internal/callback`, `/internal/execution-complete`
- [x] `apps/api/src/services/scoring.ts` — task scoring через Claude

### 1.5 n8n Workflows
- [x] `apps/workflows/.../orchestrator.workflow.ts` — маршрутизация по сценарию
- [x] `apps/workflows/.../scenario-a.workflow.ts` — один агент
- [x] `apps/workflows/.../scenario-b.workflow.ts` — Marketer → Content Maker, JSON handoff
- [x] `apps/workflows/.../scenario-c.workflow.ts` — параллельные агенты
- [x] `apps/workflows/.../scenario-d.workflow.ts` — итеративный цикл с Evaluator

---

## Этап 2 — Tests ✅ ЗАВЕРШЁН

> Приоритет: high. Spec: `docs/TEST_GUIDE.md`

- [x] `apps/api/tests/auth.test.ts` — register, login, refresh, me
- [x] `apps/api/tests/projects.test.ts` — create, list, get, members
- [x] `apps/api/tests/profile.test.ts` — get/update project profile
- [x] `apps/api/tests/tasks.test.ts` — create (scoring), execute, SSE, clarification
- [x] `apps/api/tests/approvals.test.ts` — approve, reject, revision flow
- [x] `apps/api/tests/knowledge.test.ts` — CRUD, RAG search, budget enforcement
- [x] `apps/api/tests/callback.test.ts` — agent-completion, callback, execution-complete
- [x] `packages/ai-engine/tests/token-monitor.test.ts` — counters, limits, Prometheus output
- [x] `packages/ai-engine/tests/rag.test.ts` — budget trim, minSimilarity filter

---

## Этап 3 — Frontend (Next.js 14) ❌ НЕ НАЧАТ

> `apps/frontend/` — инфраструктура развернута.

### 3.1 Инфраструктура
- [x] Next.js 14 + App Router setup в `apps/frontend/`
- [x] Tailwind CSS + shadcn/ui
- [x] API client (fetch wrapper с JWT)
- [x] Auth context + useAuth hook

### 3.2 Auth pages
- [x] `/login` — форма входа
- [x] `/register` — форма регистрации

### 3.3 Dashboard
- [x] `/dashboard` — список проектов
- [x] `/projects/new` — создание проекта

### 3.4 Project pages
- [x] `/projects/[id]` — задачи проекта, SSE-стрим
- [x] `/projects/[id]/profile` — просмотр / редактирование профиля
- [x] `/projects/[id]/knowledge` — база знаний

### 3.5 Task UI
- [x] Форма создания задачи + отображение score
- [x] Просмотр вывода агентов в реальном времени (SSE)
- [x] Approval flow — кнопки approve / request revision
- [x] Clarification flow — ответ на вопросы при score 25–39

---

## Этап 4 — DevOps / Production readiness ✅ ЗАВЕРШЁН

- [x] Prisma migrations — финализировать и проверить `001_rls_policies.sql`
- [x] `docker-compose.yml` — проверить все сервисы, env vars, healthchecks
- [x] `.env.example` — полный список переменных
- [x] Prometheus scrape config для `/metrics`
- [x] Readme с инструкцией запуска (`docs/SETUP.md`)

---

## Этап 5 — Hardening & Advanced Features ⏳ В ПРОЦЕССЕ

- [x] Переход на JWT RS256 (асимметричные ключи) — логика и генератор готовы
- [ ] Реализация Manager Escalation (проверка Evaluator threshold)
- [x] Горизонтальное масштабирование SSE через Redis Pub/Sub
- [ ] Интеграция `runAgentStreaming` в `packages/ai-engine`

---

## Текущая задача
 Активная задача: Codex routes hardening (`agent/routes`): knowledge RLS/pagination + SSE shim cleanup.
 Статус: Завершено у Codex.
 Следующий шаг: Review/merge ветки `agent/routes`.
- Файл контекста: `docs/CONTEXT.md` + `context/kits/cavekit-overview.md`.
- Координация агентов: добавлены root `AGENTS.md`, root `CLAUDE.md`, `docs/AGENT_SYNC.md`; оба агента должны читать их перед работой и обновлять этот блок при handoff.
- n8n risk: `n8nac-config.json` указывает `apps/workflows/local_5678_fa9037/personal`, а существующие workflow TS лежат в `apps/workflows/local_5678_igor_g/personal`; перед workflow-правками обязательно запускать `npx --yes n8nac list`.
- Последняя проверка n8n (`2026-04-20`): `npx --yes n8nac list` показал 5 local-only workflow (`orchestrator`, `scenario-a/b/c/d`) и 2 remote-only (`My workflow`, `My workflow 2`); workflow source ещё не синхронизирован с remote.
- Последняя handoff-запись: Codex исправил P1 findings: `.gitignore` больше не игнорирует nested `apps/api/src/lib/`, `apps/api/src/lib/sse.ts` добавлен в index, SSE stream проверяет membership и task ownership до открытия соединения, task execution валидирует `API_BASE_URL`/`N8N_WEBHOOK_URL`, ожидает n8n webhook response и переводит execution/task в FAILED при ошибке; тесты добавлены в `tests/integration/tasks.test.ts`; валидация: `npm run build --workspace=apps/api` pass, `npm run test:integration` 89 passed; следующий шаг: remaining P1/P2 review items.
- Handoff `2026-04-20`: Codex на `agent/routes` исправил knowledge embedding UPDATE через `withProjectContext`, завернул raw search SQL в project context, добавил pagination для `GET /knowledge`, удалил deprecated `sseClients` shim; затронуты `apps/api/src/routes/knowledge.ts`, `apps/api/src/lib/sse.ts`; валидация: `npx tsc --noEmit -p apps/api/tsconfig.json` pass, `git diff --check` pass.
- Открытые вопросы: нет.
