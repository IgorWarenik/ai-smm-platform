# AI Marketing Platform

AI Marketing Platform is a local-first marketing automation workbench. It combines a Next.js frontend, a Fastify API, PostgreSQL with pgvector, Redis, n8n workflows, MinIO storage, and Prometheus metrics.

The product lets a user create projects, configure a model provider, create marketing tasks, review generated output, request revisions, and manage project knowledge for RAG. The frontend includes task management, a Kanban board, Calendar, Library, and a Knowledge Base per project.

## Current Stack

| Layer | Current implementation |
| --- | --- |
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS |
| API | Fastify 4, TypeScript, JWT auth |
| Database | PostgreSQL 16, Prisma, pgvector, Row Level Security |
| Cache / realtime | Redis, SSE task streams |
| AI engine | Provider router for Claude, DeepSeek, ChatGPT/OpenAI, Gemini; Voyage AI for embeddings |
| Workflows | n8n for workflow orchestration, with n8n-as-code workflow files |
| Storage | MinIO S3-compatible storage |
| Metrics | `/metrics` endpoint plus Prometheus |

This is not a FastAPI, CrewAI, Celery, pytest, ruff, or black project.

## Services

Docker Compose exposes these local services:

| Service | URL / port |
| --- | --- |
| Frontend | `http://localhost:3002` |
| API | `http://localhost:3001` |
| API health | `http://localhost:3001/health` |
| API metrics | `http://localhost:3001/metrics` |
| n8n | `http://localhost:5678` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6380` |
| MinIO console | `http://localhost:9001` |
| Prometheus | `http://localhost:9090` |

Inside Docker, the API talks to PostgreSQL as `postgres:5432`, Redis as `redis:6379`, n8n as `http://n8n:5678`, and MinIO as `minio:9000`.

## Quick Start

Use Docker Compose as the reliable local start path:

```bash
cp .env.example .env
# edit .env with real secrets and API keys
docker compose up -d --build
```

Check the running stack:

```bash
curl http://localhost:3001/health
curl -I http://localhost:3002/login
docker compose ps
```

The API container runs `prisma db push` on startup and ensures the pgvector knowledge schema exists. The frontend container serves Next.js on container port `3000`, mapped to host port `3002`.

`start-dev.sh` is still present, but Docker Compose is the current source of truth for running the full local stack.

## Environment

Docker Compose reads `.env` from the repository root. The API container also mounts that file at `/repo/.env`, because model settings can be updated from the UI.

Minimum secrets for normal local work:

```bash
JWT_SECRET=...
JWT_REFRESH_SECRET=...
INTERNAL_API_TOKEN=...
N8N_ENCRYPTION_KEY=...
N8N_API_KEY=...
VOYAGE_API_KEY=...
```

Model provider settings:

```bash
MODEL_PROVIDER=GEMINI # CLAUDE | DEEPSEEK | CHATGPT | GEMINI
MODEL_API_KEY=...
MODEL_API_URL=...

ANTHROPIC_API_KEY=...
ANTHROPIC_API_URL=https://api.anthropic.com

OPENAI_API_KEY=...
OPENAI_API_URL=https://api.openai.com/v1

DEEPSEEK_API_KEY=...
DEEPSEEK_API_URL=https://api.deepseek.com

GEMINI_API_KEY=...
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta
```

The Settings page (`/settings`) contains Model AI configuration. The Model tab lets you select a provider, enter an API key and URL, save the config, and run a live connection test. Saving writes the selected provider, API key, and API URL into `.env` and also updates the running API process — no API container restart required. If a model call fails at runtime, the error is stored in Redis (`model:last_error`) and shown in the Settings / Model AI section.

Do not commit `.env` or real API keys.

## Model Providers

The selected `MODEL_PROVIDER` is used by agent execution and streaming.

| Provider | API style |
| --- | --- |
| `CLAUDE` | Anthropic Messages API |
| `CHATGPT` | OpenAI-compatible chat completions |
| `DEEPSEEK` | OpenAI-compatible chat completions |
| `GEMINI` | Google `generateContent` endpoint |

Gemini requests are built in the Google format:

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"contents":[{"parts":[{"text":"Explain how AI works in a few words"}]}]}'
```

`GEMINI_API_URL` may be either a base URL such as `https://generativelanguage.googleapis.com/v1beta` or a full model endpoint. The code appends the API key as the `key` query parameter.

Voyage AI is still required for embeddings and knowledge retrieval.

## Task Lifecycle

Task creation is asynchronous:

1. `POST /api/projects/:projectId/tasks` creates the task immediately.
2. The API returns `201` with status `QUEUED`.
3. Scoring and scenario execution run in the background.
4. The frontend polls and uses SSE to display task progress and output.

Quality score is internal and is not displayed in the UI. If a task does not have enough useful input, the UI shows:

```text
Not enough input. Please describe the task in more detail.
```

Review Output is stored in the system and rendered as Markdown in the frontend. Supported formatting includes headings, bold and italic text, inline code, fenced code blocks, links, lists, blockquotes, and tables.

Scenario A currently runs directly through the API. Other scenario execution paths use n8n workflows and internal API callbacks.

## API Examples

Register and login:

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"Demo User"}'

curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

Create a project:

```bash
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo Project","description":"Local marketing automation test"}'
```

Create a task:

```bash
curl -X POST http://localhost:3001/api/projects/$PROJECT_ID/tasks \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input":"Create an Instagram post with image direction and copy about our mission."}'
```

List tasks:

```bash
curl http://localhost:3001/api/projects/$PROJECT_ID/tasks \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Search project knowledge:

```bash
curl "http://localhost:3001/api/projects/$PROJECT_ID/knowledge/search?q=brand%20voice" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

## n8n Workflows

n8n is used for workflow orchestration and callbacks into the API. The current n8n-as-code active workflow directory is declared in `n8nac-config.json`:

```text
apps/workflows/local_5678_igor_g/personal
```

Before editing or publishing workflows, confirm the active instance:

```bash
npx --yes n8nac list
```

Do not guess workflow paths. There are older local workflow directories in the repository; `n8nac-config.json` and `n8nac list` are the source of truth.

## Development Commands

Install dependencies for a package:

```bash
npm install --prefix apps/api
npm install --prefix apps/frontend
npm install --prefix packages/db
npm install --prefix packages/ai-engine
```

Internal shared API utilities live in `apps/api/src/lib/`: `utils.ts` (shared `withTimeout`), `redis-client.ts` (Redis singleton), `sse.ts` (SSE helpers).

Type-check:

```bash
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/frontend/tsconfig.json
npx tsc --noEmit -p packages/ai-engine/tsconfig.json
```

Run API tests:

```bash
npx vitest run --config vitest.config.ts
npx vitest run --config vitest.config.ts apps/api/tests/tasks.test.ts
```

Run frontend build:

```bash
npm --prefix apps/frontend run build
```

Run E2E tests against the Docker frontend:

```bash
BASE_URL=http://localhost:3002 npm --prefix apps/e2e run test
```

## Logs and Monitoring

API logs:

```bash
docker compose logs -f api
```

Frontend logs:

```bash
docker compose logs -f frontend
```

n8n logs:

```bash
docker compose logs -f n8n
```

Model-call and token telemetry can be found in API logs by searching for:

```text
agent_step_telemetry
token_usage
API error
Ignoring workflow model
```

Redis also stores telemetry keys such as:

```text
agent_step_telemetry
agent_step_telemetry:{taskId}
```

Prometheus scrapes the API metrics endpoint. Open `http://localhost:9090` or call `http://localhost:3001/metrics`.

## Troubleshooting

If task creation fails with a provider or billing message, check the selected provider in Settings → Model AI, the matching key in `.env`, and `docker compose logs -f api`. The last model error is also shown in the Settings UI if Redis is running.

If n8n webhook execution fails, confirm n8n is healthy and workflows are active/published:

```bash
docker compose ps n8n
npx --yes n8nac list
```

If Review Output briefly appears and then shows a loading state, check the task detail endpoint and API logs. Output is expected to persist in the database once callback or direct execution saves it.

If knowledge search or embeddings fail, verify `VOYAGE_API_KEY`.

If API startup takes time, check logs. The API syncs Prisma schema and pgvector columns before starting.

## Documentation

Relevant project docs:

- [Architecture](docs/ARCHITECTURE.md)
- [API spec](docs/API_SPEC.md)
- [Debug protocol](docs/DEBUG_PROTOCOL.md)
- [Testing guide](docs/TEST_GUIDE.md)
- [Docker notes](docs/DOCKER.md)
- [Spec index](specs/README.md)
- [Agent sync](docs/AGENT_SYNC.md)
- [n8n agent rules](docs/AGENTS.md)

Project coordination state lives in `WORKPLAN.md`. Agent chat and implementation handoffs live in `AGENTS_CHAT.md`.
