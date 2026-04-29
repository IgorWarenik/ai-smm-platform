# Технический обзор архитектуры

Архитектурно это **монолитное приложение с несколькими инфраструктурными контейнерами**, а не микросервисная система. Бизнес-логика в основном живёт в одном API, а остальные контейнеры дают ему БД, кеш, оркестрацию, файлы, метрики и логи.

## Главная схема

Пользователь работает во frontend:

```text
Browser -> Next.js Frontend -> Fastify API -> Postgres / Redis / MinIO / n8n / AI providers
```

Контейнеры:

- `frontend` — Next.js UI, порт `3002`
- `api` — Fastify backend, порт `3001`
- `postgres` — PostgreSQL + pgvector, порт `5432`
- `redis` — кеш, SSE/pubsub, n8n queue, порт `6380` наружу
- `n8n` — workflow engine для сценариев агентов, порт `5678`
- `minio` — S3-like хранилище файлов, console `9001`
- `prometheus` — метрики, порт `9090`
- `loki` + `promtail` + `grafana` — логи и dashboards, Grafana `3003`

## API — центр системы

`apps/api` это главный backend. Он:

- проверяет JWT;
- валидирует входные данные через Zod;
- работает с Postgres через Prisma;
- создаёт проекты, задачи, профили, knowledge base;
- запускает scoring задачи;
- отправляет задачу в n8n;
- принимает callback от n8n;
- хранит результат агентов;
- отдаёт SSE stream во frontend;
- отдаёт `/metrics` для Prometheus.

То есть API — не просто прокси. Это центр бизнес-логики.

## Frontend

`apps/frontend` — Next.js 14. Он не ходит напрямую в БД, Redis, MinIO или n8n. Он общается только с API:

```text
Frontend -> /api/projects/...
```

Фронтенд показывает:

- dashboard;
- задачи;
- создание задачи;
- kanban/calendar/library;
- базу знаний;
- настройки модели;
- approval/revision flow;
- live-progress через SSE.

## Postgres + Prisma + pgvector

Postgres хранит основные данные:

- users;
- projects;
- project profiles;
- tasks;
- executions;
- agent outputs;
- knowledge items;
- approvals;
- billing и т.д.

Prisma — библиотека ORM внутри API. Она не отдельный сервис. Код API вызывает Prisma Client, Prisma генерирует SQL и ходит в Postgres.

```text
API code -> Prisma Client -> PostgreSQL
```

`pgvector` — расширение PostgreSQL. Оно нужно, чтобы хранить embeddings и искать похожие фрагменты knowledge base по смыслу.

## Knowledge / RAG

Когда пользователь загружает материалы в базу знаний:

1. API принимает текст/файл.
2. Файл режется на chunks.
3. Для каждого chunk вызывается Voyage AI.
4. Voyage возвращает embedding-вектор.
5. Вектор сохраняется в Postgres в `knowledge_items.embedding`.
6. При semantic search API снова вызывает Voyage для запроса.
7. Потом ищет ближайшие chunks через pgvector.
8. Эти chunks передаются агенту как контекст.

Основная AI-модель для поиска не нужна. Для семантического поиска используется Voyage AI, а не Claude/Gemini/OpenAI.

## AI execution

Задача проходит lifecycle:

```text
POST /tasks -> QUEUED -> scoring -> PENDING/RUNNING -> AWAITING_APPROVAL -> COMPLETED
```

Сначала API создаёт задачу и запускает scoring. Scoring определяет:

- достаточно ли данных;
- какой сценарий нужен: `A`, `B`, `C`, `D`.

Сценарии:

- `A` — один агент;
- `B` — Marketer -> Content Maker;
- `C` — Marketer и Content Maker параллельно;
- `D` — Marketer -> Content Maker -> Evaluator, до 3 итераций.

Scenario A сейчас может выполняться прямо через API. Более сложные сценарии идут через n8n.

## n8n

n8n здесь не микросервис с бизнес-данными. Это workflow engine.

API отправляет в n8n payload:

- `taskId`;
- `projectId`;
- `scenario`;
- `input`;
- `callbackUrl`;
- `projectProfile`.

n8n выполняет сценарий:

- вызывает internal API для completion;
- запрашивает RAG через API;
- передаёт результат от агента к агенту;
- возвращает callback обратно в Fastify.

Важно: n8n не должен напрямую лазить в БД. Он общается с API.

## Redis

Redis используется для:

- кеша embeddings;
- кеша agent responses;
- token counters;
- telemetry;
- n8n queue backend;
- realtime/SSE supporting state.

Это не основное хранилище данных. Основная правда — Postgres.

## MinIO

MinIO — локальный S3-compatible storage. Нужен для файлов:

- загруженные материалы;
- brand assets;
- task attachments;
- потенциально generated outputs.

Метаданные о файлах всё равно хранятся в Postgres, а blob лежит в MinIO.

## Observability

Метрики:

```text
API /metrics -> Prometheus -> Grafana
```

Логи:

```text
Docker logs -> Promtail -> Loki -> Grafana
```

Loki API на `/` может отдавать `404`, это нормально. Смотреть надо через Grafana или Loki endpoints типа `/ready`, `/loki/api/v1/query`.

## Почему контейнеры видят друг друга

Docker Compose создаёт одну сеть `ai-marketing-net`. Внутри неё сервисы доступны по имени:

- API видит Postgres как `postgres:5432`
- API видит Redis как `redis:6379`
- API видит n8n как `http://n8n:5678`
- API видит MinIO как `minio:9000`

Это задаётся в `docker-compose.yml`, а не “автоматически из кода”.

Коротко: **код цельный, но runtime разложен на контейнеры по инфраструктурным ролям**. Это обычная архитектура монолита с отдельными backing services.
