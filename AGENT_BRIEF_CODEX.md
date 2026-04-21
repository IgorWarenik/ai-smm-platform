# Agent Brief — Codex
## Wave 12 | Branch: `agent/dockerfiles-v1`

**Goal:** Create production Dockerfiles for API and Frontend so `docker-compose up` works.
Current root `Dockerfile` is Python/FastAPI — wrong stack, replace it.

**Rules:**
- New branch from main: `git checkout -b agent/dockerfiles-v1`
- Touch ONLY the files listed below
- Do NOT touch any existing source files, configs, or tests
- Do NOT merge — Claude reviews
- On finish: commit, write report to `AGENTS_CHAT.md` under `## Wave 12 → Codex`
- Validation: `docker build -f apps/api/Dockerfile . --target=runner --no-cache 2>&1 | tail -5` — must NOT error

---

## Stack context

```
Monorepo root: /repo  (docker build context = repo root)
Node.js version: 20 LTS
Package manager: npm (individual per package — no root workspace)

apps/api/
  package.json         scripts: build=tsc, start=node dist/index.js
  tsconfig.json        outDir=./dist, rootDir=../..   ← builds into apps/api/dist/
  src/index.ts         entry point

apps/frontend/
  package.json         scripts: build=next build, start=next start
  next.config.ts
  src/                 Next.js App Router

packages/shared/       imported by both api and frontend
packages/db/           imported by api (prisma client)
packages/ai-engine/    imported by api
```

**Key facts:**
- `apps/api/tsconfig.json` has `rootDir: "../.."` — tsc must run from repo root, not from `apps/api/`
- `@ai-marketing/shared`, `@ai-marketing/db`, `@ai-marketing/ai-engine` linked via `node_modules` symlinks
- API listens on `PORT` env var (default 3001), health: `GET /health`
- Frontend listens on port 3000, env: `NEXT_PUBLIC_API_URL`
- Prisma client binary baked into node_modules (no re-generate needed at runtime)

---

## File 1: `apps/api/Dockerfile`

Multi-stage Node 20 image. Build context = repo root.

Requirements:
- Stage `deps`: install ALL node_modules (root + packages/* + apps/api)
- Stage `builder`: copy source, run `npx tsc -p apps/api/tsconfig.json` — produces `apps/api/dist/`
- Stage `runner`: copy only `node_modules` + compiled `apps/api/dist/` — no dev deps, no source
- USER nonroot (uid 1001)
- EXPOSE 3001
- HEALTHCHECK `curl -f http://localhost:3001/health || exit 1`
- CMD `["node", "apps/api/dist/apps/api/src/index.js"]`
  (outDir=apps/api/dist, rootDir=../.., so compiled path mirrors source path from root)

Prisma note: copy `packages/db/node_modules/.prisma/` and `node_modules/.prisma/` into runner stage — Prisma needs the native binary.

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /repo

# Copy all package.json files first (layer cache)
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package-lock.json* ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json packages/db/package-lock.json* ./packages/db/
COPY packages/ai-engine/package.json packages/ai-engine/package-lock.json* ./packages/ai-engine/

# Install deps for each package
RUN npm install --prefix apps/api --ignore-scripts 2>/dev/null || npm install --prefix apps/api
RUN npm install --prefix packages/db --ignore-scripts 2>/dev/null || npm install --prefix packages/db
RUN npm install --prefix packages/shared --ignore-scripts 2>/dev/null || npm install --prefix packages/shared
RUN npm install --prefix packages/ai-engine --ignore-scripts 2>/dev/null || npm install --prefix packages/ai-engine

# --- builder ---
FROM node:20-alpine AS builder
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /repo/packages/shared/node_modules* ./packages/shared/
COPY --from=deps /repo/packages/ai-engine/node_modules* ./packages/ai-engine/

# Copy source
COPY apps/api ./apps/api
COPY packages ./packages

RUN npx tsc -p apps/api/tsconfig.json

# --- runner ---
FROM node:20-alpine AS runner
WORKDIR /repo

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=deps --chown=appuser:nodejs /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps --chown=appuser:nodejs /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=builder --chown=appuser:nodejs /repo/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=appuser:nodejs /repo/packages/db/prisma ./packages/db/prisma

# Prisma engine binary
COPY --from=deps /repo/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /repo/packages/db/node_modules/.prisma ./packages/db/node_modules/.prisma

USER appuser
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

ENV NODE_ENV=production
CMD ["node", "apps/api/dist/apps/api/src/index.js"]
```

**IMPORTANT:** Verify the actual compiled output path by checking what `tsc -p apps/api/tsconfig.json` produces given `outDir=./dist` and `rootDir=../..`. The entry point relative to repo root will be `apps/api/dist/apps/api/src/index.js`. If different, adjust CMD accordingly.

---

## File 2: `apps/frontend/Dockerfile`

Standard Next.js standalone output.

Requirements:
- Stage `deps`: install `apps/frontend` deps
- Stage `builder`: `npm run build` inside `apps/frontend` with `NEXT_TELEMETRY_DISABLED=1`
- Stage `runner`: copy Next.js standalone output (`.next/standalone` + `.next/static`)
- USER nonroot (uid 1001)
- EXPOSE 3000
- ENV `NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0`
- CMD `["node", "server.js"]` (from standalone output)

Add to `apps/frontend/next.config.ts`:
```ts
output: 'standalone'
```
(If `output: 'standalone'` already present — skip. If not — add it. Read the file first.)

```dockerfile
# apps/frontend/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY apps/frontend/package.json apps/frontend/package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/frontend .
COPY packages/shared /repo/packages/shared
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public 2>/dev/null || true

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## File 3: Replace root `Dockerfile`

Current `Dockerfile` at repo root is Python/FastAPI — wrong stack, leftover from early iteration.
Replace entirely with a notice:

```dockerfile
# This file is intentionally minimal — the repo uses per-service Dockerfiles.
# API:      apps/api/Dockerfile
# Frontend: apps/frontend/Dockerfile
# Compose:  docker-compose.yml (builds both)
```

---

## Validation

```bash
# Syntax check (no actual build — needs Docker daemon):
docker build -f apps/api/Dockerfile . --no-cache --target deps 2>&1 | tail -5
docker build -f apps/frontend/Dockerfile . --no-cache --target deps 2>&1 | tail -5

# tsc compile check (no Docker needed):
npx tsc -p apps/api/tsconfig.json --noEmit 2>&1 | head -10

# Verify next.config.ts has standalone:
grep "standalone" apps/frontend/next.config.ts
```

All must pass with 0 errors. If Docker daemon not available, tsc check + grep are sufficient.

---

## How to submit

1. `git checkout -b agent/dockerfiles-v1` from main
2. Create/modify files listed above
3. Run validation commands
4. Commit with message: `feat(docker): add API and frontend Dockerfiles, replace stale root Dockerfile`
5. Write report to `AGENTS_CHAT.md` under `## Wave 12 → Codex`
6. Report to human: "done, agent/dockerfiles-v1 ready for review"
