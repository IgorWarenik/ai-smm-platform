# Docker & Containerization Guide

## 🐳 Project Containerization

This project is fully containerized using Docker and Docker Compose for easy deployment across environments.

---

## 📁 Docker Files

### `Dockerfile` — Multi-stage build for production
- **Stage 1 (Builder):** Install Node dependencies and build TypeScript app
- **Stage 2 (Runtime):** Minimal runtime image with only necessary files
- **Non-root user:** Runs as `appuser` (UID 1000) for security
- **Health check:** Built-in health endpoint check every 30s
- **Port:** API exposes 3001 for Fastify

### `docker-compose.yml` — Complete stack orchestration
Services included:
- **postgres** — PostgreSQL 16 with pgvector for vector search
- **redis** — Redis 7 for caching and n8n queue mode
- **api** — Fastify application server
- **n8n** — workflow orchestration
- **minio** — S3-compatible file storage (alternative to AWS S3)

### `.dockerignore` — Reduces build context size
- Excludes unnecessary files (Python cache, git, node_modules, etc.)
- Speeds up Docker builds

---

## 🚀 Quick Start

### 1. **Prepare environment:**
```bash
cp .env.example .env.local
# Edit .env.local with your actual API keys:
# - ANTHROPIC_API_KEY
# - VOYAGE_API_KEY
# - JWT_SECRET
# - etc.
```

### 2. **Build and start:**
```bash
docker-compose up -d
```

### 3. **Verify all services:**
```bash
docker-compose ps
```
Expected output: All services showing `Up` status

### 4. **Test API:**
```bash
curl http://localhost:3001/health
# Should return: {"status": "ok"}
```

---

## 📊 Service Ports

| Service | Port | Purpose |
| ----- | ----- | ----- |
| Fastify API | 3001 | REST API |
| n8n | 5678 | Workflow orchestration |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache & queue |
| MinIO API | 9000 | File storage (S3 compatible) |
| MinIO Console | 9001 | Web UI for S3 management |

---

## 🔧 Common Commands

### View logs:
```bash
docker-compose logs -f api               # Fastify API logs
docker-compose logs -f n8n               # Workflow logs
docker-compose logs -f postgres          # Database logs
```

### Execute commands in container:
```bash
docker-compose exec api node -v
docker-compose exec postgres psql -U aimarketer -d ai_marketing -c "SELECT version();"
```

### Rebuild after dependency changes:
```bash
docker-compose build --no-cache
docker-compose up -d
```

### Stop services:
```bash
docker-compose down
```

### Stop and remove volumes (CAUTION - deletes data):
```bash
docker-compose down -v
```

---

## 🔐 Security Best Practices

1. **Environment Variables:** Never hardcode secrets in Dockerfile
2. **Non-root user:** Always run containers as non-root (appuser)
3. **Health checks:** Containers restart if unhealthy
4. **Network isolation:** Uses custom bridge network (`ai-marketing-net`)
5. **Database credentials:** Randomize passwords in production

---

## 📈 Production Considerations

### For production deployment:
1. Use version tags for images: `python:3.11-slim` → `python:3.11.5-slim`
2. Store secrets in external vault (AWS Secrets Manager, HashiCorp Vault)
3. Use orchestration platform (Kubernetes, Docker Swarm)
4. Enable logging aggregation (ELK Stack, Grafana Loki)
5. Set resource limits in docker-compose
6. Use read-only filesystems where possible
7. Implement CI/CD pipeline to automate builds

---

## 🧪 Development vs Production

### Development:
```bash
ENVIRONMENT=development LOG_LEVEL=DEBUG docker-compose up
```

### Production:
```bash
ENVIRONMENT=production LOG_LEVEL=INFO docker-compose up -d
```

---

## 🚨 Troubleshooting

### Container exits immediately:
```bash
docker-compose logs api
# Check error message and review requirements or environment variables
```

### Permission denied errors:
```bash
# Ensure .env.local has correct paths and Redis/DB are accessible
docker-compose exec api id  # Should show non-root runtime user when configured
```

### Port already in use:
```bash
# Change port mapping in docker-compose.yml:
# "3001:3001" → "3002:3001"
```

---

## 📚 Refer to

- `SETUP.md` — Full development setup guide
- `.env.example` — All environment variables
- `Dockerfile` — Image build configuration
- `docker-compose.yml` — Service orchestration
