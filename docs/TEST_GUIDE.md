# Test Guide for AI Marketing Platform

Этот документ — компактный справочник по тестированию Fastify, n8n workflows и AI-логики.

## Основное правило
- `specs/` — главный источник требований.
- Перед задачей выбери минимальный контекст через `docs/context_map.md`.
- После правок запускай проверки из ближайшего `package.json`.
- Python `pytest` используй только для ручного Voyage smoke test `tests/ai_sanity_check.py` или если сознательно меняешь Python helper.

## Типы Проверок
| Тип | Что проверять | Инструмент |
|---|---|---|
| Fastify API | Статусы, payload, auth, ошибки | `npm run build`, route tests |
| Zod contracts | Валидация входа/выхода | unit tests around `packages/shared` |
| n8n workflows | Routing, callbacks, payload shape | n8n-as-code validate/test |
| AI engine | model-provider router, Voyage embeddings, token limits, cache fallback | unit tests with provider mocks |
| RAG | `maxCharsPerChunk`, `maxTotalChars`, `minSimilarity` | unit/API tests with mocked embeddings |

## Быстрые Рекомендации
- Для API и shared contracts сначала проверь Zod-схемы.
- Моки model provider / Voyage обязательны для unit-тестов: это экономит токены и делает тесты воспроизводимыми.
- Для workflow меняй один scenario-файл за раз и проверяй payload callbacks.
- Интеграционные тесты размещай в `tests/integration/`.

## Запуск
```bash
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/frontend/tsconfig.json
npx tsc --noEmit -p packages/ai-engine/tsconfig.json
npx vitest run --config vitest.config.ts
BASE_URL=http://localhost:3002 npm --prefix apps/e2e run test

# Manual only
pytest tests/ai_sanity_check.py
```

Если зависимости не установлены, зафиксируй это в результате проверки и не подменяй сборку чтением кода.

## Ошибки И Отладка
- Если падает API, сначала проверь route schema и shared types.
- Если падает workflow, сравни payload с `specs/agent-orchestration.md` и `docs/agent_protocol.md`.
- Если баг с внешним AI, добавь мок provider response и повтори.

## Контекст И Экономия Токенов
- Не дублируй правила в каждом ответе.
- Сосредоточься на feature-spec и файлах из `docs/context_map.md`.
- Для зависимостей читай контракты, а не реализацию, если задача не требует изменения этой зависимости.
