#!/bin/bash
set -e

echo "🚀 Starting AI Marketing Platform bootstrap..."

# 1. Проверка .env (Docker & API source)
if [ ! -f .env ] && [ ! -f .env.local ]; then
    echo "⚠️  Env file not found. Creating .env from .env.example..."
    cp .env.example .env
    echo "❌ Action Required: Edit .env with your API keys and restart."
    exit 1
fi

# 2. Установка зависимостей
echo "📦 Installing workspace dependencies..."
npm install

# 3. Запуск инфраструктуры (БД, Redis, n8n, MinIO)
echo "🐳 Starting Docker infrastructure..."
# Запускаем только необходимые компоненты, если планируем запускать api/frontend локально для разработки
docker-compose up -d postgres redis n8n minio prometheus

# 4. Ожидание готовности PostgreSQL
echo "⏳ Waiting for PostgreSQL to be ready..."
until docker-compose exec -T postgres pg_isready -U aimarketer > /dev/null 2>&1; do
  sleep 2
done

# 5. Prisma: миграции и сид
echo "⛑️  Synchronizing database schema..."
npx prisma migrate dev --schema packages/db/prisma/schema.prisma
npx prisma db seed --schema packages/db/prisma/schema.prisma

echo "🛡️  Applying RLS Policies..."
docker-compose exec -T postgres psql -U aimarketer -d ai_marketing -f /dev/stdin < 001_rls_policies.sql || \
  echo "⚠️  RLS policies application failed or already applied."

if lsof -i :3001 > /dev/null; then
  echo "❌ Error: Port 3001 is already in use. Kill the process and try again."
  exit 1
fi

# 6. Запуск dev-серверов
echo "✨ All systems go. Launching API and Frontend..."
if ! command -v npx &> /dev/null; then
    echo "npx not found, installing concurrently..."
    npm install -g concurrently
fi

npx concurrently \
  --names "API,FE" \
  --prefix-colors "blue,green" \
  "npm run dev --workspace=apps/api" \
  "npm run dev --workspace=apps/frontend" | tee -a dev.log