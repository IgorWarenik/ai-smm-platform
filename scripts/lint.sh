#!/bin/bash

set -euo pipefail

echo "Running lightweight repo checks..."

echo "TypeScript checks..."
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/frontend/tsconfig.json
npx tsc --noEmit -p packages/ai-engine/tsconfig.json

echo "Legacy-term sweep..."
rg -n -i "crewai|fastapi|uvicorn|celery" . \
  --glob '!node_modules/**' \
  --glob '!.git/**' \
  --glob '!apps/workflows/**/n8n-workflows.d.ts' || true

echo "Done."
