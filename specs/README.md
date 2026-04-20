# Spec-Driven Development Guide

## Контекст
`specs/` — основной контракт. Любая функция должна быть описана в спецификации до разработки.

## Индекс спецификаций
- `auth-projects-profile.md` — регистрация, логин, проекты, профиль проекта.
- `task-lifecycle.md` — создание задач, scoring, статусы, запуск execution.
- `agent-orchestration.md` — n8n сценарии A/B/C/D, callbacks, handoff агентов.
- `knowledge-rag.md` — Knowledge DB, embeddings, RAG search, Redis embedding cache.
- `token-monitoring.md` — учёт токенов Claude/Voyage, Redis-счётчики, лимиты, Prometheus.

## Принцип работы
1. Найди релевантный файл в `specs/`.
2. Открой `docs/context_map.md` и выбери минимальные implementation-файлы.
3. Если спецификации нет — создай её или задай уточняющий вопрос.
4. Если есть сомнения, уточни до начала разработки.
5. Тесты пишутся перед реализацией.

## Формат спецификации
Каждый файл `specs/*.md` должен содержать:
- `title:` краткое название
- `status:` draft / approved
- `priority:` high / medium / low
- `last_updated:` YYYY-MM-DD
- `scope:` что включает фича
- `acceptance_criteria:` требования
- `examples:` вход / выход

### Пример
```
title: Create marketing task endpoint
status: approved
priority: high
last_updated: 2026-04-10
scope:
  - POST /api/projects/{projectId}/tasks
  - validate task input with Zod
  - require JWT auth
acceptance_criteria:
  - returns 201 on valid payload
  - returns 422 on invalid payload
  - task saved with project_id
examples:
  request:
    input: Разработай SMM-кампанию для запуска продукта
  response:
    data:
      id: ...
      status: PENDING
      scenario: B
```

## Рабочий процесс
- `specs/` + `docs/TEST_GUIDE.md` = контракт.
- По спецификации сначала пишутся тесты, потом реализация.
- Обновляй `last_updated`, если меняешь требования.

## Минимальные правила
- Любая новая фича должна иметь свою спецификацию.
- Спецификация должна быть достаточно детальной для написания тестов.
- Не начинай код до утверждённой спеки или уточнения.

## Токен-экономия
- Используй спецификации как короткий контекст.
- Для задачи сначала открой один файл из индекса выше, а не широкие `docs/ARCHITECTURE.md` или `docs/CLAUDE.md`.
- Затем используй `docs/context_map.md`, чтобы не читать реализации зависимых модулей без необходимости.
- Не пересказывай весь проект в каждом запросе.
- Ссылайся на `specs/` и `docs/TEST_GUIDE.md`.
