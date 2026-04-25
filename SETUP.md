# Setup & Deployment Guide

## Prerequisites

- Node.js 20+
- npm
- Docker with `docker compose`
- Model provider API key for the provider you want to use
- Voyage AI API key for embeddings / RAG

## Recommended Local Start

```bash
cp .env.example .env
# fill in real secrets
docker compose up -d --build
```

Service URLs:

- Frontend: `http://localhost:3002`
- API: `http://localhost:3001`
- n8n: `http://localhost:5678`
- MinIO console: `http://localhost:9001`
- Prometheus: `http://localhost:9090`

## Alternative Dev Flow

To run API and frontend dev servers locally while infra stays in Docker:

```bash
./start-dev.sh
```

That script starts PostgreSQL, Redis, n8n, MinIO, and Prometheus in Docker, then launches local dev servers for:

- API on `http://localhost:3001`
- Frontend on `http://localhost:3000`

## Health Checks

```bash
curl http://localhost:3001/health
curl -I http://localhost:3002/login
docker compose ps
```

## Validation

```bash
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/frontend/tsconfig.json
npx tsc --noEmit -p packages/ai-engine/tsconfig.json
npx vitest run --config vitest.config.ts
```

## Monitoring

- Prometheus metrics: `http://localhost:3001/metrics`
- n8n dashboard: `http://localhost:5678`
- API logs: `docker compose logs -f api`
