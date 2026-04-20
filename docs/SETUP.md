# 🚀 Project Setup Guide

## 1️⃣ Environment Variables

Copy `.env.example` to `.env.local` and fill in your actual API keys:

```bash
cp .env.example .env.local
```

### Required API Keys:

| Key | Service | Where to Get |
| ----- | ----- | ----- |
| `ANTHROPIC_API_KEY` | Claude API | https://console.anthropic.com |
| `VOYAGE_API_KEY` | Voyage AI Embeddings | https://www.voyageai.com |
| `DATABASE_URL` | PostgreSQL | Local or cloud provider |
| `REDIS_URL` | Redis Cache | Local or cloud provider |
| `EMBED_CACHE_TTL_SECONDS` | Embedding cache lifetime | Optional, default 86400 seconds |
| `S3_*` or `MINIO_*` | File Storage | AWS S3 or self-hosted MinIO |
| `COHERE_API_KEY` | Speech-to-Text | https://cohere.com |
| `JWT_SECRET` | Auth tokens | Generate a random string |

---

## 2️⃣ Node.js Environment Setup

```bash
cd apps/api
npm install
```

---

## 3️⃣ Database Setup

### Create PostgreSQL database:
```bash
createdb ai_marketing
```

### Enable pgvector extension:
```bash
psql -d ai_marketing -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Run migrations:
```bash
cd packages/db
npm run db:migrate
```

---

## 4️⃣ Redis Setup (for caching & task queue)

```bash
# Using Docker
docker run -d -p 6379:6379 redis:7

# Or locally (macOS with Homebrew)
brew install redis
brew services start redis
```

---

## 5️⃣ n8n Workflows

The n8n configuration is already in `n8nac-config.json`. 

To list workflows:
```bash
npx --yes n8nac list
```

---

## 6️⃣ Start Development

### Terminal 1 - Fastify API
```bash
cd apps/api
npm run dev
```

### Terminal 2 - Frontend (if applicable)
```bash
cd apps/frontend
npm run dev
```

### Terminal 3 - n8n Workflows
```bash
npx --yes n8nac list
```

---

## 7️⃣ Verify Setup

Check API health:
```bash
curl http://localhost:3001/health
```

Using fetch-mcp:
```bash
fetch-mcp --url "http://localhost:3001/health"
```

---

## � Docker Setup (Recommended for Production)

### Prerequisites:
- Docker 20.10+
- Docker Compose 2.0+

### Quick Start:

1. **Clone and setup environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

2. **Build and start containers:**
   ```bash
   docker-compose up -d
   ```

3. **Verify services are running:**
   ```bash
   docker-compose ps
   ```

### Services in Docker Compose:
- **postgres** — PostgreSQL 16 with pgvector
- **redis** — Redis 7 for caching/queues
- **api** — Fastify API backend (port 3001)
- **n8n** — workflow orchestration (port 5678)
- **minio** — S3-compatible file storage (ports 9000, 9001)

### Check API health:
```bash
curl http://localhost:3001/health
```

### View logs:
```bash
docker-compose logs -f api
docker-compose logs -f n8n
```

### Stop containers:
```bash
docker-compose down
```

### Clean up (remove volumes):
```bash
docker-compose down -v
```

---

### Issue: `tsc: command not found`
Run dependency installation in the package being built, for example `cd apps/api && npm install`.

### Issue: PostgreSQL connection failed
Check `DATABASE_URL` in `.env.local`. Default: `postgresql://user:password@localhost:5432/ai_marketing`

### Issue: Redis connection failed
Ensure Redis is running: `redis-cli ping` should return `PONG`

---

## 📋 Refer to DEBUG_PROTOCOL.md for troubleshooting
See [DEBUG_PROTOCOL.md](./DEBUG_PROTOCOL.md) for autonomous debugging guide.
