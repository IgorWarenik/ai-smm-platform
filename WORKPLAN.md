# Work Plan — AI SMM Platform

> Отмечай `[x]` когда шаг завершён. Читай этот файл в начале каждой сессии.

---

## Статус проекта

**Готовность MVP: 100%** `[██████████]`
**Тесты:** 127/127 unit — E2E написаны (7), не запущены
**Ветка:** `main` | Последний merge: Wave 14

### Блоки открытых задач

| # | Блок | Приоритет | Статус |
|---|------|-----------|--------|
| W14 | **Wave 14** — production bugfixes, multi-provider AI, dark UI | 🔴 HIGH | ✅ смержен |
| E1 | **E2E-тесты** — запустить против живого стека (`docker-compose up`) | 🟡 MED | ✅ пройдены локально: 7/7 Playwright |
| E2 | **n8n workflows push** — n8n webhook нестабилен локально, Scenario A работает напрямую | 🟡 MED | ✅ pushed + activated после Docker reset |
| E3 | **Production deploy** — cloud env, secrets, smoke test | 🟡 MED | ❌ не начато |

> После Docker reset локальный стек снова рабочий; E1 теперь разблокирован.

### n8n статус (E2)

- `n8nac-config.json` → `local_5678_igor_g` ✅ активен после re-init
- n8n owner bootstrap выполнен после чистой БД (`igor@local.dev`), новый Public API key выпущен для локального sync
- 5 workflows — `TRACKED` в `n8nac list`
- 5 workflows — `active = true` в n8n
- Smoke test: `POST http://localhost:5678/webhook/orchestrator` → `200 {"message":"Workflow was started"}`

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

## Текущая задача (Local stack recovery — 2026-04-25)

**Статус:** Docker Desktop после destructive reset восстановлен; стек поднят; n8n re-init выполнен; workflows pushed + activated; E2E на живом стеке зелёные.

**Active task owner:** Codex
- intent: завершено — Wave 16-FE: `ApprovalPanel` flat restyle, `Kanban`, `/calendar`, `/library`
- likely files: `apps/frontend/src/components/ApprovalPanel.tsx`, `apps/frontend/src/app/tasks/page.tsx`, `apps/frontend/src/app/calendar/page.tsx`, `apps/frontend/src/app/library/page.tsx`, `AGENTS_CHAT.md`, `WORKPLAN.md`
- expected validation: `npx tsc --noEmit -p apps/frontend/tsconfig.json`, `npx vitest run --config vitest.config.ts`

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

**Следующий шаг:** E3 — production deploy / cloud env / smoke test.

**n8n риск:** после reset появились служебные локальные артефакты `n8nac` и stale workflow folders; перед cleanup или новыми правками workflow сначала смотреть `npx --yes n8nac list` и активный `workflowDir` в `n8nac-config.json`.

**E2E note:** в `apps/e2e/tests/` обновлены 2 ожидания под текущий UI:
- login error assertion теперь проверяет текст `Invalid credentials`
- placeholder task form теперь `Describe the campaign, channel, and result you need...`

**Latest bug fix (2026-04-26, Codex):**
- bug: `Failed to fetch` на `http://localhost:3000/projects/new` при `Create Project`
- root cause: CORS в API разрешал Docker frontend `http://localhost:3002`, но не локальный dev frontend `http://localhost:3000`
- files touched: `apps/api/src/app.ts`, `AGENTS_CHAT.md`, `WORKPLAN.md`
- validation: `tsc api` pass, `vitest 127/127` pass, preflight from `Origin: http://localhost:3000` → `204`, authenticated `POST /api/projects` from `3000` origin → `201`
- next step: если пользователь продолжит работать через `3000`, можно отдельно прогнать UI smoke в браузере для `/projects/new`

**Latest bug fix (2026-04-26, Codex):**
- bug: задача после `Отправить агентам` могла отображаться как `Черновик` и не уходить моделям
- root cause:
  `PENDING` был замаплен во frontend как `Черновик`;
  create-task flow не блокировал отправку без `project profile`;
  scoring и direct Scenario A не имели таймаута, поэтому молчащий provider оставлял задачу в `QUEUED`
- files touched: `apps/api/src/routes/tasks.ts`, `apps/api/src/services/scoring.ts`, `apps/frontend/src/components/StatusBadge.tsx`, `apps/frontend/src/app/new/page.tsx`, `apps/api/tests/tasks.test.ts`, `WORKPLAN.md`
- validation:
  `npx vitest run --config vitest.config.ts apps/api/tests/tasks.test.ts` → 21/21 pass
  `npx tsc -p apps/api/tsconfig.json --noEmit` → pass
  `npm --prefix apps/frontend run type-check` → pass
  live smoke: create task without profile → `422 PROFILE_MISSING`; after profile PUT, create task → `QUEUED` then `AWAITING_APPROVAL` with `execution.status=COMPLETED`
- next step: старые зависшие `QUEUED` задачи, созданные до фикса, автоматически не догонятся; их лучше пересоздать из UI после заполнения profile

**Latest bug fix (2026-04-26, Codex):**
- bug: проекты пропали из меню layout
- root cause: `Sidebar` был статическим и вообще не рендерил список проектов, хотя `/api/projects` возвращал данные
- files touched: `apps/frontend/src/components/layout/Sidebar.tsx`, `WORKPLAN.md`
- validation:
  `npm --prefix apps/frontend run type-check` → pass
  `docker compose build frontend && docker compose up -d frontend` → pass
  browser smoke after login: sidebar section `ПРОЕКТЫ` показывает `Smoke dispatch timeout 2026-04-26`, `Smoke task dispatch 2026-04-26`, `Печеньки`
- next step: при желании можно отдельно ограничить список recent-projects или добавить search, но bug закрыт

**Latest bug fix (2026-04-28, Codex):**
- bug: настройки модели выглядели так, будто у всех провайдеров пропали API keys; тест модели после rebuild/restart не видел ключи кроме Anthropic
- root cause: model config хранится не в БД, а в `/repo/.env`; `docker-compose.yml` не пробрасывал `MODEL_*`, `OPENAI_*`, `GEMINI_*`, `DEEPSEEK_*` в runtime `process.env`, а UI держал один общий `hasKey` вместо статуса по каждому провайдеру
- files touched: `apps/api/src/routes/model-config.ts`, `apps/frontend/src/app/settings/page.tsx`, `docker-compose.yml`, `WORKPLAN.md`
- validation: `tsc api` pass, `tsc frontend` pass, `docker compose build api frontend && docker compose up -d api frontend` pass, live `GET /model-config` shows `providerKeys` with Claude/OpenAI/Gemini present and DeepSeek absent
- note: `projects.settings` in Postgres is `{}` for all projects; отдельной таблицы model config нет, текущий source of truth для ключей — `.env`

**Latest bug fix (2026-04-28, Codex):**
- bug: семантический поиск показывал `Результаты поиска (0)`, хотя файлы были загружены
- root cause: default `minSimilarity=0.72` был завышен для `voyage-3-lite` embeddings; реальные top scores по текущим chunks около `0.33–0.46`. Дополнительно API restart стирал `knowledge_items.embedding`, потому что Prisma schema не знала про vector column, а entrypoint запускал `prisma db push --accept-data-loss`
- files touched: `packages/shared/src/schemas.ts`, `packages/ai-engine/src/rag-budget.ts`, `packages/db/prisma/schema.prisma`, `docker-compose.yml`, `.env`, `.env.example`, `docs/API_SPEC.md`, `docs/ENV_SETUP.md`, `WORKPLAN.md`
- validation: `tsc api` pass, `docker compose build api && docker compose up -d api` pass, embeddings remain `14/14` after restart, live search returns results for `Session Mind`, `инвестиции фонд активы`, `фасилитатор стратегическая сессия`
- note: active `.workflow.ts` defaults still mention `0.72`; not edited in this fix because n8n workflow edits require separate sync/pull/push protocol. Runtime n8n gets `RAG_MIN_SIMILARITY=0.3` from `.env` after restart.

**Latest frontend fix (2026-04-28, Codex):**
- task: подсветить в выдаче базы знаний фрагмент, который считается наиболее релевантным запросу
- files touched: `apps/frontend/src/app/project/knowledge/page.tsx`, `WORKPLAN.md`
- behavior: search results now show a short snippet, exact query terms highlighted with `<mark>`, semantic-only matches highlighted as the relevant snippet, and similarity percent when API returns it
- validation: `npx tsc --noEmit -p apps/frontend/tsconfig.json` pass, `docker compose build frontend && docker compose up -d frontend` pass, built bundle contains highlight classes

**Latest config change (2026-04-28, Codex):**
- task: set RAG similarity threshold to `0.15` everywhere
- files touched: `.env`, `.env.example`, `docker-compose.yml`, `packages/ai-engine/src/rag-budget.ts`, `packages/shared/src/schemas.ts`, `docs/API_SPEC.md`, `docs/ENV_SETUP.md`, `apps/api/tests/feedback.test.ts`, `apps/api/tests/knowledge.test.ts`, active workflow files in `apps/workflows/local_5678_igor_g/personal/`, `WORKPLAN.md`
- validation: `npx --yes n8nac list` showed active tracked local workflow dir, `npx tsc --noEmit -p apps/api/tsconfig.json` pass, `docker compose build api && docker compose up -d api` pass, API runtime has `RAG_MIN_SIMILARITY=0.15`, live search `ассистент` and `и/и помощник` return 4 results each

**Latest frontend/API fix (2026-04-28, Codex):**
- task: in file upload, replace category dropdown with file content description field
- files touched: `apps/frontend/src/app/project/knowledge/page.tsx`, `apps/api/src/routes/knowledge.ts`, `WORKPLAN.md`
- behavior: upload form now has `Описание содержимого файла`; frontend sends `description` in multipart upload; backend stores it in `knowledge_items.metadata.description` for every chunk; file list shows saved description; upload category falls back to `BRAND_GUIDE`
- validation: `npx tsc --noEmit -p apps/frontend/tsconfig.json` pass, `npx tsc --noEmit -p apps/api/tsconfig.json` pass, `docker compose build api frontend && docker compose up -d api frontend` pass, frontend bundle contains `Описание содержимого файла`

**Latest bug fix (2026-04-26, Codex):**
- bug: в профиле проекта поля `Продукты / Услуги` и `Целевая аудитория` не сохраняли введённое
- root cause: frontend отправлял `products` и `audience` как строки, а API schema ждёт массивы объектов; ошибки `PATCH /profile` проглатывались, поэтому UI выглядел как “не сохранилось”
- files touched: `apps/frontend/src/app/project/page.tsx`, `WORKPLAN.md`
- validation:
  `npm --prefix apps/frontend run type-check` → pass
  `docker compose build frontend && docker compose up -d frontend` → pass
  browser smoke on `/project`: save both fields, reload page, values видны снова
  API smoke: `GET /api/projects/353bda0b-5d26-435a-b33c-f5e0e3d1d5d8/profile` returns structured `products[]` and `audience[]`
- next step: аналогичный string-vs-object UX есть ещё у некоторых сложных profile полей (`competitors`, `socialLinks`, `kpi`); чинить только если пользователь упирается в них

**Latest bug fix (2026-04-26, Codex):**
- bug: раскрытие `Tier 3 — Расширенный профиль` падало с `Objects are not valid as a React child`
- root cause: frontend пытался рендерить сырые объекты `socialLinks` / `kpi` как React child
- files touched: `apps/frontend/src/app/project/page.tsx`, `WORKPLAN.md`
- validation:
  `npm --prefix apps/frontend run type-check` → pass
  `docker compose build frontend && docker compose up -d frontend` → pass
  browser smoke: открыть `/project`, раскрыть `Tier 3`, поля `Соцсети (ссылки)` и `KPI / метрики` видны, `Objects are not valid as a React child` больше нет
- next step: для consistency уже добавлен parse/save path и для `competitors`, `socialLinks`, `kpi`; если пользователь начнёт ими пользоваться, базовая форма уже готова

**Latest bug fix (2026-04-26, Codex):**
- bug: на экране задачи в статусе `На согласовании` текст и панели были белыми/плохо читаемыми
- root cause: `ApprovalPanel` оставался на старых `glass-*` / `text-white` / `text-zinc-*` классах и не соответствовал текущей светлой теме приложения
- files touched: `apps/frontend/src/components/ApprovalPanel.tsx`, `WORKPLAN.md`
- validation:
  `npm --prefix apps/frontend run type-check` → pass
  `docker compose build frontend && docker compose up -d frontend` → pass
  browser smoke on `/tasks?selected=5858679c-37a4-4ad5-b430-84385988f6b8`:
  `Review Output` найден
  `panelBg = rgb(255, 255, 255)`
  `headingColor = rgb(9, 9, 11)`
  `textareaColor = rgb(9, 9, 11)`
  `paragraphColor = rgb(9, 9, 11)`
- next step: если понадобится, можно отдельно локализовать английские подписи `Review Output`, `Approve`, `Request Revision`, но контрастный баг закрыт

**Latest frontend task (2026-04-26, Codex):**
- task: выполнить `Wave 16-FE` из `AGENT_BRIEF_CODEX.md`
- what changed:
  `apps/frontend/src/app/tasks/page.tsx` — добавлен toggle `List / Kanban` и kanban-колонки по статусам
  `apps/frontend/src/app/calendar/page.tsx` — реализован календарь завершённых задач с навигацией по месяцам и сайд-панелью дня
  `apps/frontend/src/app/library/page.tsx` — реализована библиотека готовых артефактов с copy-to-clipboard и deep-link на `/tasks?selected=<id>`
  `apps/frontend/src/components/ApprovalPanel.tsx` — финально выровнен под flat design brief
- validation:
  `npx tsc --noEmit -p apps/frontend/tsconfig.json` → pass
  `npx vitest run --config vitest.config.ts` → pass (`10 files / 128 tests`)
  `npm --prefix apps/frontend run build` → pass
  `git diff --check -- apps/frontend/src/components/ApprovalPanel.tsx apps/frontend/src/app/tasks/page.tsx apps/frontend/src/app/calendar/page.tsx apps/frontend/src/app/library/page.tsx WORKPLAN.md AGENTS_CHAT.md` → pass
- handoff:
  отчёт записан в `AGENTS_CHAT.md` под `## Wave 16-FE → Codex`
  безопасный branch split / commit в этой сессии не делался, потому что shared worktree уже был грязным и содержал посторонние живые изменения
- next step: Claude/пользовательский визуальный smoke на `Kanban`, `Calendar`, `Library`, затем уже отдельный чистый branch/commit если понадобится reviewable PR
