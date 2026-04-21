# Work Plan — AI Marketing Platform

> Отмечай `[x]` когда шаг завершён. Читай этот файл в начале каждой сессии.

---

## Статус проекта

**Готовность MVP: 95%** `[█████████░]`
**Тесты:** 125 / ~135 (цель) — unit, нет E2E
**Ветка:** `main` | Последний merge: Wave 7

### Блоки открытых задач

| # | Блок | Приоритет | Статус |
|---|------|-----------|--------|
| W8 | **Wave 8** — PATCH task + Toast + Delete UI | 🔴 HIGH | ✅ смержен |
| E1 | **E2E-тесты** — Playwright: login→create task→approve flow | 🟡 MED | ❌ не начато |
| E2 | **n8n reconcile** — устранить расхождение `fa9037` vs `igor_g` путей | 🟡 MED | ❌ не начато |
| E3 | **Production deploy** — cloud env, secrets, smoke test | 🟡 MED | ❌ не начато |
| E4 | **PATCH task UI** — редактор input для PENDING/REJECTED задач | 🟢 LOW | ❌ не начато (backend будет в W8) |
| E5 | **Pagination UI** — кнопка "Load more" на task list | 🟢 LOW | ❌ не начато |

> После Wave 8 — 95%+. Блоки E1–E3 нужны для production-ready.

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

## Этап 3 — Frontend (Next.js 14) ✅ ЗАВЕРШЁН

> Merged to main. tsc: 0 errors. 110/110 tests pass.

### 3.1 Инфраструктура
- [x] Next.js 14 + App Router setup в `apps/frontend/` (Claude)
- [x] Tailwind CSS (Claude, без shadcn — Tailwind-only)
- [x] API client `src/lib/api.ts` — apiFetch, auto-refresh, cookie (Gemini)
- [x] Auth context `src/contexts/auth.tsx` + useAuth hook (Gemini)
- [x] Route protection `src/middleware.ts` (Gemini)

### 3.2 Auth pages
- [x] `/login` — форма входа (Claude)
- [x] `/register` — форма регистрации (Claude)

### 3.3 Dashboard
- [x] `/dashboard` — список проектов (Claude)
- [x] `/projects/new` — создание проекта (Claude)

### 3.4 Project pages
- [x] `/projects/[id]` layout + tasks page (creation, SSE, clarification, approval) (Gemini)
- [x] `/projects/[id]/profile` — просмотр / редактирование профиля (Claude)
- [x] `/projects/[id]/knowledge` — база знаний + семантический поиск (Gemini)

### 3.5 Task UI components
- [x] ApprovalPanel component (Gemini)
- [x] useTaskStream hook (SSE) (Gemini)
- [x] ClarificationForm (inline в tasks page) (Gemini)

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

## Этап 5b — Backend Hardening ✅ ЗАВЕРШЁН (merged to main)

> Codex ветка `agent/hardening` смержена. 103/103 тестов.

- [x] `packages/shared/src/schemas.ts` — `CreateApprovalSchema` + MIN_REVISION_CHARS validation при REVISION_REQUESTED
- [x] `packages/shared/src/schemas.ts` — `TaskQuerySchema` с опциональным `status` фильтром
- [x] `apps/api/src/routes/tasks.ts` — GET /tasks поддерживает `?status=` фильтр
- [x] `apps/api/src/index.ts` — fail-fast валидация env vars при запуске
- [x] `apps/api/tests/feedback.test.ts` — 8 тестов для GET/POST feedback routes

---

## Текущая задача (Wave 8 — 2026-04-21)

**Статус:** Waves 1–8 ✅ смержены. 125/125 тестов.

| Этап | Статус |
|------|--------|
| 1 Backend Core | ✅ |
| 2 Tests | ✅ |
| 3 Frontend | ✅ |
| 4 DevOps | ✅ |
| 5 Hardening | ✅ |
| 5b Backend Hardening | ✅ |
| Wave 4 Knowledge CRUD | ✅ |
| Wave 5 DELETE task + UUID guards + Frontend UX | ✅ |
| Wave 6 Rate limit + member removal + settings page | ✅ |
| Wave 7 GET /members + nav active state + UX polish | ✅ |
| Wave 8 PATCH task + Toast + Delete UI | ✅ |

**Следующий шаг:** Wave 9 или E1–E3 (E2E, n8n reconcile, deploy).

**n8n риск:** `n8nac-config.json` указывает `apps/workflows/local_5678_fa9037/personal`, существующие workflow в `apps/workflows/local_5678_igor_g/personal`. Перед правками workflow запускать `npx --yes n8nac list`.
