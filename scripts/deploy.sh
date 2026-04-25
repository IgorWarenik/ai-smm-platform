#!/bin/bash

set -euo pipefail

ENVIRONMENT=${1:-local}

if [[ "$ENVIRONMENT" != "local" ]]; then
  echo "Only local Docker deployment is scripted in this repository."
  echo "Usage: ./scripts/deploy.sh local"
  exit 1
fi

echo "Running pre-deploy checks..."
./scripts/test.sh

echo "Building and starting local Docker stack..."
docker compose up -d --build

echo "Health checks..."
curl -fsS http://localhost:3001/health >/dev/null
curl -fsSI http://localhost:3002/login >/dev/null

cat <<'EOF'

Local deploy complete.

Useful commands:
- docker compose ps
- docker compose logs -f api
- docker compose logs -f frontend
- docker compose logs -f n8n

EOF
