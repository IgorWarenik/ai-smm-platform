#!/bin/bash

set -euo pipefail

echo "Setting up AI Marketing Platform..."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose is required."
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env
  echo "Edit .env before running the full stack."
fi

echo "Installing package dependencies..."
npm install --prefix packages/shared
npm install --prefix packages/db
npm install --prefix packages/ai-engine
npm install --prefix apps/api
npm install --prefix apps/frontend
npm install --prefix apps/e2e

echo "Generating Prisma client..."
npm --prefix packages/db run db:generate

echo "Starting local stack..."
docker compose up -d postgres redis n8n minio prometheus

cat <<'EOF'

Setup complete.

Recommended next steps:
1. Fill in .env with real API keys and secrets.
2. Start the full app stack:
     docker compose up -d --build
3. Check health:
     curl http://localhost:3001/health
     curl -I http://localhost:3002/login
4. For local dev servers instead of Docker app containers:
     ./start-dev.sh

EOF
