# AI Agent Marketing Platform — Guidance

## 1. О Проекте
AI Agent Marketing Platform — многопользовательский сервис для автоматизации маркетинга и контент-продакшна.

Цель: изолированные проектные пространства, где агенты `marketer`, `content_maker` и `evaluator` выполняют задачи уровня Middle+/Senior, а клиент видит прогресс, результаты и этап согласования.

## 2. Фактический Стек
- Frontend: Next.js 14, React, Tailwind CSS, shadcn/ui.
- Backend API: Node.js + TypeScript + Fastify.
- Orchestration: n8n-as-code workflows в `apps/workflows/`.
- AI engine: TypeScript package `packages/ai-engine` для Claude, Voyage AI, RAG, token monitoring.
- DB: PostgreSQL 16 + pgvector, Prisma contracts in `packages/db`.
- Shared contracts: Zod schemas and TS types in `packages/shared`.
- Cache/queue: Redis, n8n queue mode.
- File storage: MinIO / S3-compatible storage.

FastAPI, CrewAI и LangChain не являются текущей runtime-архитектурой проекта. Если старый документ говорит обратное, приоритет имеют `docs/ARCHITECTURE.md`, `specs/`, `docs/context_map.md` и фактический код.

## 3. Агенты
`marketer`: senior marketing strategist. Output: strategic brief, key messages, channels, metrics, constraints.

`content_maker`: senior copywriter/content strategist. Uses marketer brief. Output: final publishable content.

`evaluator`: strict quality checker. Output: compact JSON score, pass/fail, revision feedback.

Длинные expertise-блоки не повторяются в каждом запросе; используй короткие role cards из `packages/ai-engine/src/prompts/role-cards.ts`.

## 4. Handoff Protocol
Связь агентов описана в `docs/agent_protocol.md`. Для `marketer -> content_maker` передавай строгий JSON, а не свободный markdown-бриф.

Правила:
- Не передавать chain-of-thought, черновики, историю диалога и внутренние детали реализации.
- Content Maker должен парсить JSON handoff и работать только по полям `summary`, `inputs`, `expected_output`, `open_questions`.
- Если JSON невалидный, workflow должен завершиться ошибкой, а не угадывать смысл.

## 5. Сценарии Оркестрации
- Scenario A: один агент.
- Scenario B: `marketer -> content_maker`, последовательный строгий JSON handoff.
- Scenario C: marketer и content maker работают параллельно, результаты объединяются.
- Scenario D: marketer -> content maker -> evaluator, максимум 3 итерации; revision передаётся как дельта.

Workflow-файлы лежат в `apps/workflows/local_5678_igor_g/personal/`.

## 6. RAG И Контекст
RAG проходит через Fastify knowledge API и `packages/ai-engine`.

Обязательные budget-поля:
- `maxCharsPerChunk`: максимум символов на один найденный фрагмент.
- `maxTotalChars`: максимум символов RAG-контекста на запрос.
- `minSimilarity`: минимальный similarity для включения фрагмента.

Workflow не должен ходить в PostgreSQL напрямую за RAG-контекстом.

## 7. Token Budgets
Не используй один общий output token budget для всех вызовов. Бюджеты разделены:
- scoring: `MAX_TOKENS_SCORING`
- evaluator JSON: `MAX_TOKENS_EVALUATOR_JSON`
- marketer brief: `MAX_TOKENS_MARKETER_BRIEF`
- content generation: `MAX_TOKENS_CONTENT_GENERATION`
- revision delta: `MAX_TOKENS_REVISION_DELTA`

Контракт описан в `specs/token-monitoring.md`.

## 8. Что Нельзя Ломать
- Изоляция данных по `project_id`.
- Порог принятия задачи: score >= 25.
- Scenario B/D handoff и итерационную логику.
- Согласование публичных и стратегических материалов.
- Token monitoring и fallback на cache при превышении лимитов.

## 9. Рабочий Процесс
1. **Читай `WORKPLAN.md` первым** — там текущий статус этапов и активная задача.
2. Найди feature-spec в `specs/`.
3. Выбери файлы через `docs/context_map.md`.
4. Читай контракты зависимостей вместо реализации, если зависимость не меняется.
5. Внеси минимальное изменение.
6. Запусти релевантные проверки из `docs/TEST_GUIDE.md`.
7. Обнови `WORKPLAN.md` — отметь завершённые шаги `[x]`, обнови блок "Текущая задача".
