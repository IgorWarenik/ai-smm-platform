# Tool Protocol

Короткий контракт инструментов агентов. Текущая runtime-оркестрация проекта — n8n workflows + Fastify API. Этот файл описывает, как подключать внешние источники к агентам без прямого доступа workflow к БД или сети в обход контрактов.

## Базовый Набор
- `web_search` — поиск в сети для трендов, новостей, площадок, конкурентов и свежих рыночных сигналов.
- `marketing_cases_db` — доступ к базе маркетинговых кейсов, фреймворков, шаблонов, SEO-данных и best practices.
- `knowledge_search` — проектный RAG через Fastify endpoint `/api/projects/:projectId/knowledge/search`.

## Разделение Ответственности
- Fastify API публикует стабильный HTTP-контракт инструмента.
- n8n Code nodes вызывают только публичные endpoints, а не PostgreSQL напрямую.
- AI engine отвечает за Claude/Voyage, token monitoring, cache fallback и RAG budget.
- Результат работы инструмента передаётся между агентами через `docs/agent_protocol.md`.

## RAG Budget
Любой инструмент, который добавляет knowledge context в prompt, обязан применять:
- `maxCharsPerChunk`
- `maxTotalChars`
- `minSimilarity`

## Назначение Инструментов
- `marketer` получает `web_search`, `marketing_cases_db` и `knowledge_search`, если задаче нужен анализ рынка, ЦА, конкурентов, позиционирования или KPI.
- `content_maker` по умолчанию использует JSON handoff от `marketer`; свежий внешний контекст добавляется только если это явно указано в задаче или handoff.
- `evaluator` не вызывает исследовательские tools без прямой необходимости.

## Пример Потока
1. `marketer` вызывает `knowledge_search` через Fastify API с RAG budget.
2. `marketer` формирует strict JSON handoff по `docs/agent_protocol.md`.
3. n8n передаёт JSON handoff в `content_maker`.
4. `content_maker` создаёт результат на основе handoff и ограниченного RAG-контекста.

## Минимальный Контракт Tool
Каждый новый инструмент должен иметь:
- стабильное имя;
- описание, когда его использовать;
- типизированный вход;
- типизированный выход;
- ограничения безопасности;
- RAG/token budget, если инструмент добавляет данные в prompt;
- тесты с моками для сети, БД и внешних API.
