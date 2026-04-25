#!/bin/bash

set -euo pipefail

echo "Running type checks and tests..."

echo "TypeScript checks..."
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/frontend/tsconfig.json
npx tsc --noEmit -p packages/ai-engine/tsconfig.json

echo "API tests..."
npx vitest run --config vitest.config.ts

cat <<'EOF'

Done.

Optional:
- Run a focused API suite:
    npx vitest run --config vitest.config.ts apps/api/tests/tasks.test.ts
- Run E2E against a live stack:
    BASE_URL=http://localhost:3002 npm --prefix apps/e2e run test
- Run the manual Voyage smoke test:
    pytest tests/ai_sanity_check.py

EOF
