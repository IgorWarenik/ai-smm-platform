# Setup & Deployment Guide

## Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Anthropic & Voyage AI API Keys

## ⚡ Quick One-Command Start

```bash
chmod +x start-dev.sh
./start-dev.sh
```

## Quick Start

1. **Clone & Install**:
   ```bash
   git clone <repo>
   npm install
   ```

2. **Environment**:
   ```bash
   cp .env.example .env
   ```

3. **Infrastructure**:
   ```bash
   docker-compose up -d
   ```

4. **Database**:
   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

5. **Run Services**:
   - API: `npm run dev --workspace=apps/api`
   - Frontend: `npm run dev --workspace=apps/frontend`

## Monitoring
Prometheus metrics are available at `http://localhost:3001/metrics`.
n8n dashboard is at `http://localhost:5678`.