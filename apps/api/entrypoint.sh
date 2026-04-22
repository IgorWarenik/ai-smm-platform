#!/bin/sh
set -e

echo "Syncing DB schema..."
./packages/db/node_modules/.bin/prisma db push \
  --schema packages/db/prisma/schema.prisma \
  --accept-data-loss \
  --skip-generate 2>&1 || echo "Warning: schema sync failed, continuing"

echo "Starting API..."
exec node apps/api/dist/apps/api/src/index.js
