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

## Этап 3 — Frontend (Next.js 14) ⏳ В ПРОЦЕССЕ

> `apps/frontend/` не существует. Gemini строит с нуля на ветке `agent/frontend`.

### 3.1 Инфраструктура
- [ ] Next.js 14 + App Router setup в `apps/frontend/`
- [ ] Tailwind CSS + shadcn/ui
- [ ] API client (fetch wrapper с JWT + auto-refresh)
- [ ] Auth context + useAuth hook

### 3.2 Auth pages
- [ ] `/login` — форма входа
- [ ] `/register` — форма регистрации
- [ ] Route protection middleware

### 3.3 Dashboard
- [ ] `/dashboard` — список проектов
- [ ] `/projects/new` — создание проекта

### 3.4 Project pages
- [ ] `/projects/[id]` — задачи проекта, SSE-стрим
- [ ] `/projects/[id]/profile` — просмотр / редактирование профиля
- [ ] `/projects/[id]/knowledge` — база знаний

### 3.5 Task UI
- [ ] Форма создания задачи + отображение score
- [ ] Просмотр вывода агентов в реальном времени (SSE)
- [ ] Approval flow — кнопки approve / request revision
- [ ] Clarification flow — ответ на вопросы при score 25–39

---

## Этап 4 — DevOps / Production readiness ✅ ЗАВЕРШЁН

- [x] Prisma migrations — финализировать и проверить `001_rls_policies.sql`
- [x] `docker-compose.yml` — проверить все сервисы, env vars, healthchecks
- [x] `.env.example` — полный список переменных
- [x] Prometheus scrape config для `/metrics`
- [x] Readme с инструкцией запуска (`docs/SETUP.md`)

---

## Этап 5 — Hardening & Advanced Features ✅ ЗАВЕРШЁН

- [x] Переход на JWT RS256 (асимметричные ключи) — логика и генератор готовы
- [x] Реализация Manager Escalation — `APPROVAL_MAX_REVISIONS` + `managerEscalated` + `requiresReview` в approvals.ts
- [x] Горизонтальное масштабирование SSE через Redis Pub/Sub
- [x] Интеграция `runAgentStreaming` в `packages/ai-engine` — экспортирована из claude.ts

## Этап 5b — Backend Hardening ⏳ В ПРОЦЕССЕ (Wave 3)

> Codex строит на ветке `agent/hardening`. Задачи из `AGENT_BRIEF_CODEX.md`.

- [x] `packages/shared/src/schemas.ts` — `CreateApprovalSchema` + MIN_REVISION_CHARS validation при REVISION_REQUESTED
- [x] `packages/shared/src/schemas.ts` — `TaskQuerySchema` с опциональным `status` фильтром
- [x] `apps/api/src/routes/tasks.ts` — GET /tasks поддерживает `?status=` фильтр
- [x] `apps/api/src/index.ts` — fail-fast валидация env vars при запуске
- [x] `apps/api/tests/feedback.test.ts` — 8 тестов для GET/POST feedback routes

---

## Текущая задача (Wave 3 — 2026-04-21)

**Статус:** Codex Wave 3 backend hardening завершён; Gemini frontend ещё в работе.

| Агент | Ветка | Задача | Статус |
|-------|-------|--------|--------|
| Codex | `agent/hardening` | Backend hardening (schema + tests + env) | ✅ готово |
| Gemini | `agent/frontend` | Полный Next.js 14 frontend | ⏳ в работе |

**Следующий шаг для Claude:**
1. Дождаться отчётов в `AGENTS_CHAT.md`
2. Принять работу: review diff, запустить `npx vitest run` + `npm run build --workspace=apps/frontend`
3. Если ок — merge обеих веток в main
4. Выдать Wave 4 briefs (интеграционные тесты frontend, e2e, n8n sync)

**Порядок merge:**
- `agent/hardening` сначала (изменяет shared/schemas.ts, API)
- `agent/frontend` после (зависит от API)

**n8n риск:** `n8nac-config.json` указывает `apps/workflows/local_5678_fa9037/personal`, существующие workflow в `apps/workflows/local_5678_igor_g/personal`. Перед правками workflow запускать `npx --yes n8nac list`.

**Открытые вопросы:** нет.

**Codex handoff:** `CreateApprovalSchema` теперь требует revision comment >= 50 chars для `REVISION_REQUESTED`; добавлен `TaskQuerySchema.status`; `GET /tasks` фильтрует по status; API startup валидирует required env vars внутри `main()`; добавлен `apps/api/tests/feedback.test.ts` с 8 кейсами; существующие revision approval tests обновлены валидными >=50 chars comments. Валидация: `npx tsc --noEmit -p apps/api/tsconfig.json` pass, `npx tsc --noEmit -p packages/shared/tsconfig.json` pass, `npx vitest run` pass 103/103.
