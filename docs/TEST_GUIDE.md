# Test Guide for AI Marketing Platform

Этот документ — компактный справочник по тестированию Fastify, n8n workflows и AI-логики.

## Основное правило
- `specs/` — главный источник требований.
- Перед задачей выбери минимальный контекст через `docs/context_map.md`.
- После правок запускай проверки из ближайшего `package.json`.
- Python `pytest` запускай только для Python scripts/tests, если они затронуты.

## Типы Проверок
| Тип | Что проверять | Инструмент |
|---|---|---|
| Fastify API | Статусы, payload, auth, ошибки | `npm run build`, route tests |
| Zod contracts | Валидация входа/выхода | unit tests around `packages/shared` |
| n8n workflows | Routing, callbacks, payload shape | n8n-as-code validate/test |
| AI engine | Claude/Voyage wrappers, token limits, cache fallback | unit tests with provider mocks |
| RAG | `maxCharsPerChunk`, `maxTotalChars`, `minSimilarity` | unit/API tests with mocked embeddings |

## Быстрые Рекомендации
- Для API и shared contracts сначала проверь Zod-схемы.
- Моки Claude/Voyage обязательны для unit-тестов: это экономит токены и делает тесты воспроизводимыми.
- Для workflow меняй один scenario-файл за раз и проверяй payload callbacks.
- Интеграционные тесты размещай в `tests/integration/`.

## Запуск
```bash
cd apps/api && npm run build
cd packages/shared && npx tsc --noEmit
pytest -v
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
