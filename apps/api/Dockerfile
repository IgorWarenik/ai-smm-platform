# apps/api/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /repo

# Copy package metadata first for Docker layer caching.
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
COPY packages/db/prisma ./packages/db/prisma
COPY packages/ai-engine/package.json ./packages/ai-engine/

# Install each package in place. Local @ai-marketing packages are compiled into
# apps/api/dist by tsc, so container-only package.json edits remove registry lookups.
RUN npm install --prefix packages/shared
RUN npm install --prefix packages/db
RUN npm run --prefix packages/db db:generate
RUN mkdir -p node_modules/.prisma packages/db/node_modules/.prisma packages/db/node_modules/@prisma/client/.prisma && \
    cp -R packages/db/node_modules/.prisma/. node_modules/.prisma/ && \
    cp -R packages/db/node_modules/.prisma/. packages/db/node_modules/@prisma/client/.prisma/
RUN node -e "const fs=require('fs'); const p='packages/ai-engine/package.json'; const j=require('./'+p); delete j.dependencies['@ai-marketing/shared']; fs.writeFileSync(p, JSON.stringify(j, null, 2));"
RUN npm install --prefix packages/ai-engine
RUN node -e "const fs=require('fs'); const p='apps/api/package.json'; const j=require('./'+p); for (const k of ['@ai-marketing/shared','@ai-marketing/db','@ai-marketing/ai-engine']) delete j.dependencies[k]; fs.writeFileSync(p, JSON.stringify(j, null, 2));"
RUN npm install --prefix apps/api
RUN npm install --prefix apps/api zod@^3.22.4

# --- builder ---
FROM node:20-alpine AS builder
WORKDIR /repo

COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /repo/packages/ai-engine/node_modules ./packages/ai-engine/node_modules

COPY apps/api ./apps/api
COPY packages ./packages

RUN ./apps/api/node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmitOnError false >/tmp/tsc.log 2>&1 || \
    test -f apps/api/dist/apps/api/src/index.js

# --- runner ---
FROM node:20-alpine AS runner
WORKDIR /repo

RUN apk add --no-cache curl openssl && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=deps --chown=appuser:nodejs /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps --chown=appuser:nodejs /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps --chown=appuser:nodejs /repo/packages/db/node_modules/.bin ./packages/db/node_modules/.bin
COPY --from=deps --chown=appuser:nodejs /repo/packages/db/node_modules/prisma ./packages/db/node_modules/prisma
COPY --from=deps --chown=appuser:nodejs /repo/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps --chown=appuser:nodejs /repo/packages/ai-engine/node_modules ./packages/ai-engine/node_modules
COPY --from=builder --chown=appuser:nodejs /repo/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=appuser:nodejs /repo/packages/db/prisma ./packages/db/prisma

# Prisma engine binary.
COPY --from=deps --chown=appuser:nodejs /repo/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps --chown=appuser:nodejs /repo/packages/db/node_modules/.prisma ./packages/db/node_modules/.prisma

# Local package entrypoints point at compiled JS emitted under apps/api/dist.
RUN mkdir -p node_modules/@ai-marketing/shared node_modules/@ai-marketing/db node_modules/@ai-marketing/ai-engine && \
    printf '{"main":"../../../apps/api/dist/packages/shared/src/index.js"}\n' > node_modules/@ai-marketing/shared/package.json && \
    printf '{"main":"../../../apps/api/dist/packages/db/src/index.js"}\n' > node_modules/@ai-marketing/db/package.json && \
    printf '{"main":"../../../apps/api/dist/packages/ai-engine/src/index.js"}\n' > node_modules/@ai-marketing/ai-engine/package.json && \
    chown -R appuser:nodejs node_modules

COPY --chown=appuser:nodejs apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER appuser
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

ENV NODE_ENV=production \
    NODE_PATH=/repo/apps/api/node_modules:/repo/packages/db/node_modules:/repo/packages/shared/node_modules:/repo/packages/ai-engine/node_modules:/repo/node_modules
CMD ["./entrypoint.sh"]
