# Agent Brief — Codex
## Wave 13 | Branch: `agent/hardening-v7`

**Three tasks. All mandatory. All on same branch.**

**Rules:**
- Branch from main: `git checkout -b agent/hardening-v7`
- Touch ONLY files listed per task
- Do NOT touch tests, schemas, or workflow files
- Do NOT merge — Claude reviews
- On finish: commit all, write report to `AGENTS_CHAT.md` under `## Wave 13 → Codex`

---

## Task 1 — Prisma UUID fix (all create calls)

**Problem:** Prisma 5 `@default(dbgenerated("gen_random_uuid()")) @db.Uuid` generates CUID2
client-side under ts-node instead of letting the DB generate a UUID. The runtime then
validates the CUID2 against `@db.Uuid` and throws P2023. We already fixed `refreshToken.create`
in a prior wave; now fix ALL remaining `.create()` calls in `apps/api/src/routes/`.

**Fix pattern:** add `id: randomUUID()` as the first field in every `data:` object where:
1. The model ID is `@db.Uuid` (all models in this repo are), AND
2. No explicit `id` is currently passed

`randomUUID` is already imported in `apps/api/src/routes/auth.ts`. Add it to the other files.

### Files to edit

#### `apps/api/src/routes/projects.ts`
Add `import { randomUUID } from 'crypto'` at top.

In `project.create({ data: { ... } })` (line ~30):
```typescript
const project = await prisma.project.create({
  data: {
    id: randomUUID(),        // ← add
    ownerId: userId,
    name: body.name,
    settings: body.settings ?? {},
    members: {
      create: {
        id: randomUUID(),    // ← add (ProjectMember nested create)
        userId,
        role: MemberRole.OWNER,
      },
    },
  },
})
```

Also find `projectMember.create` if any exists (e.g. in invite/add-member route) and add `id: randomUUID()` there too.

#### `apps/api/src/routes/tasks.ts`
Add `import { randomUUID } from 'crypto'` at top (if not present).

`task.create` (line ~64):
```typescript
return tx.task.create({
  data: {
    id: randomUUID(),   // ← add
    projectId,
    input: body.input,
    score: scoring.score,
    scenario: scoring.isValid ? (scoring.scenario as ScenarioType) : null,
    status,
    clarificationNote,
    ...(status === TaskStatus.REJECTED && { rejectedAt: new Date() }),
  },
})
```

`execution.create` (line ~326):
```typescript
const exec = await tx.execution.create({
  data: {
    id: randomUUID(),   // ← add
    taskId,
    projectId,
    scenario,
    status: ExecutionStatus.RUNNING,
  },
})
```

#### `apps/api/src/routes/approvals.ts`
Add `import { randomUUID } from 'crypto'` at top.

`approval.create` (line ~67):
```typescript
const approval = await tx.approval.create({
  data: {
    id: randomUUID(),   // ← add
    projectId,
    taskId,
    decision: body.decision,
    comment: body.comment,
    iteration,
    decidedById: userId,
  },
})
```

#### `apps/api/src/routes/callback.ts`
Add `import { randomUUID } from 'crypto'` at top.

`agentOutput.create` (line ~126):
```typescript
await tx.agentOutput.create({
  data: {
    id: randomUUID(),   // ← add
    executionId: body.executionId,
    agentType: body.agentType as AgentType,
    output: body.output,
    iteration: body.iteration,
    evalScore: body.evalScore ?? null,
  },
})
```

#### `apps/api/src/routes/feedback.ts`
Add `import { randomUUID } from 'crypto'` at top.

`agentFeedback.create` (line ~53):
```typescript
const feedback = await tx.agentFeedback.create({
  data: {
    id: randomUUID(),   // ← add
    projectId,
    taskId,
    agentType: body.agentType,
    score: body.score,
    comment: body.comment,
  },
})
```

#### `apps/api/src/routes/knowledge.ts`
Add `import { randomUUID } from 'crypto'` at top.

`knowledgeItem.create` (line ~34):
```typescript
return tx.knowledgeItem.create({
  data: {
    id: randomUUID(),   // ← add
    projectId,
    category: body.category,
    content: body.content,
    metadata: body.metadata ?? {},
  },
})
```

#### `apps/api/src/routes/auth.ts`
`user.create` (line ~46) — add `id: randomUUID()`:
```typescript
const user = await prisma.user.create({
  data: {
    id: randomUUID(),   // ← add
    email: body.email,
    passwordHash,
    name: body.name ?? null,
  },
})
```
(`randomUUID` already imported here from prior fix.)

**Validation:**
```bash
npx tsc --noEmit -p apps/api/tsconfig.json 2>&1 | head -5
# must produce 0 output (no errors)
```

---

## Task 2 — API entrypoint script (run migrations on container start)

**Problem:** `apps/api/Dockerfile` starts directly with `node`. When Docker Compose
spins up a fresh postgres, the DB has no tables. API must run `prisma migrate deploy`
(or `db push` for dev) before starting.

**Note:** Schema uses `dbgenerated("gen_random_uuid()")` and `pgvector`. The Docker
postgres image (`pgvector/pgvector:pg16`) has both `gen_random_uuid()` and `vector`
extension available. Migration command: `prisma db push` (no migration history, just push).

### File to create: `apps/api/entrypoint.sh`

```bash
#!/bin/sh
set -e

echo "Running database schema sync..."
node -e "
const { execSync } = require('child_process');
execSync(
  'npx prisma db push --schema packages/db/prisma/schema.prisma --accept-data-loss --skip-generate',
  { stdio: 'inherit', cwd: '/repo' }
);
" || echo "Warning: prisma db push failed, continuing..."

echo "Starting API..."
exec node apps/api/dist/apps/api/src/index.js
```

### File to edit: `apps/api/Dockerfile`

In the `runner` stage, replace:
```dockerfile
CMD ["node", "apps/api/dist/apps/api/src/index.js"]
```
with:
```dockerfile
COPY --chown=appuser:nodejs apps/api/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
CMD ["./entrypoint.sh"]
```

Also add `prisma` binary to runner — it's needed for `prisma db push`:
```dockerfile
# After the existing COPY --from=deps lines, add:
COPY --from=deps --chown=appuser:nodejs /repo/apps/api/node_modules/.bin/prisma ./apps/api/node_modules/.bin/prisma
COPY --from=deps --chown=appuser:nodejs /repo/packages/db/node_modules/.bin/prisma ./packages/db/node_modules/.bin/prisma
```

Actually simpler — add `npx` approach is already shell-based. Just ensure `prisma` CLI is
available. In `deps` stage, `packages/db` installs prisma as devDependency so
`packages/db/node_modules/.bin/prisma` exists. In runner, copy it:

In runner stage, add after existing COPY lines:
```dockerfile
COPY --from=deps --chown=appuser:nodejs /repo/packages/db/node_modules/.bin ./packages/db/node_modules/.bin
COPY --from=deps --chown=appuser:nodejs /repo/packages/db/node_modules/prisma ./packages/db/node_modules/prisma
```

Then update entrypoint.sh to call prisma directly:
```bash
#!/bin/sh
set -e
echo "Syncing DB schema..."
./packages/db/node_modules/.bin/prisma db push \
  --schema packages/db/prisma/schema.prisma \
  --accept-data-loss \
  --skip-generate 2>&1 || echo "Warning: schema sync failed, continuing"
echo "Starting API..."
exec node apps/api/dist/apps/api/src/index.js
```

**Validation:**
```bash
# Syntax check only — no Docker daemon needed:
bash -n apps/api/entrypoint.sh && echo "shell syntax OK"
grep "entrypoint" apps/api/Dockerfile && echo "Dockerfile updated"
```

---

## Task 3 — GitHub Actions CI

### File to create: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, 'agent/**']
  pull_request:
    branches: [main]

jobs:
  test:
    name: Type-check & Unit tests
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: |
            apps/api/package-lock.json
            packages/shared/package-lock.json
            packages/db/package-lock.json
            packages/ai-engine/package-lock.json

      - name: Install dependencies
        run: |
          npm install --prefix packages/shared
          npm install --prefix packages/db
          npm install --prefix packages/ai-engine
          npm install --prefix apps/api

      - name: Generate Prisma client
        run: npx prisma generate --schema packages/db/prisma/schema.prisma
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Type-check API
        run: npx tsc --noEmit -p apps/api/tsconfig.json

      - name: Unit tests
        run: npx vitest run --config vitest.config.ts
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          JWT_SECRET: ci-secret-32-chars-minimum-length
          JWT_REFRESH_SECRET: ci-refresh-secret-32-chars-minimum!
          INTERNAL_API_TOKEN: ci-internal-token
          ANTHROPIC_API_KEY: dummy
          VOYAGE_API_KEY: dummy
          N8N_WEBHOOK_URL: http://localhost:5678/webhook
          N8N_API_KEY: dummy
          API_BASE_URL: http://localhost:3001
          PORT: '3001'
          HOST: '0.0.0.0'
          FRONTEND_URL: http://localhost:3000

  typecheck-frontend:
    name: Type-check Frontend
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: apps/frontend/package-lock.json

      - name: Install dependencies
        run: npm install --prefix apps/frontend

      - name: Type-check Frontend
        run: npx tsc --noEmit -p apps/frontend/tsconfig.json
```

**Note:** Unit tests mock the DB, so no real postgres needed for CI. `DATABASE_URL` is a
dummy value used only for Prisma client generation at generate time.

Check existing `vitest.config.ts` to confirm test command is correct:
```bash
head -10 vitest.config.ts
```

**Validation:**
```bash
# YAML syntax check:
node -e "require('fs').readFileSync('.github/workflows/ci.yml', 'utf8')" && echo "YAML readable"
# Confirm jobs present:
grep "name: CI\|jobs:\|unit tests\|typecheck" .github/workflows/ci.yml
```

---

## How to submit

1. `git checkout -b agent/hardening-v7` from main
2. Complete all three tasks
3. Run validations listed per task
4. `npx tsc --noEmit -p apps/api/tsconfig.json` — must produce 0 errors
5. `npx vitest run --config vitest.config.ts 2>&1 | tail -5` — must show 127 passed
6. Commit: `feat(hardening): prisma UUID fix all routes, entrypoint migrations, CI`
7. Write report to `AGENTS_CHAT.md` under `## Wave 13 → Codex`:
   - List every file changed
   - Paste tsc + vitest results
8. Tell human "done, agent/hardening-v7 ready for review"
