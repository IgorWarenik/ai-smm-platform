# Code Style Guide

This repository is a TypeScript-first project:

- API: Fastify
- Frontend: Next.js / React
- Database: Prisma + PostgreSQL
- AI engine: TypeScript packages under `packages/`
- Workflow orchestration: n8n

Python is not part of the main runtime. The only intentional Python artifact is the manual Voyage smoke test in `tests/ai_sanity_check.py`.

## General Rules

- Prefer small, surgical changes over broad rewrites.
- Follow existing local patterns before introducing a new abstraction.
- Use TypeScript strict typing. Do not introduce implicit `any`.
- Prefer `async` / `await` over raw promise chains in route and service code.
- Keep API responses consistent with existing route conventions: most handlers return `{ data: ... }`.
- For authenticated project resources, preserve project membership checks and project isolation rules.

## Naming

Use standard TypeScript naming:

```ts
const projectId = '...'
const taskStatus = TaskStatus.PENDING

type TaskQuery = {
  page: number
  pageSize: number
}

async function createProject() {}
```

- `camelCase` for variables and functions
- `PascalCase` for components, types, enums, and schemas
- `SCREAMING_SNAKE_CASE` for environment variables and global constants

## Fastify API

- Validate input with shared Zod schemas from `packages/shared/src/schemas.ts` where possible.
- Use `reply.notFound()` for non-member project access when existing routes do that.
- Keep route handlers thin; move cross-route logic into helpers when reuse is real.
- Log external-provider failures with context, but avoid leaking secrets.
- Do not bypass project scoping when `withProjectContext(...)` is required.

Example:

```ts
app.get('/:taskId', async (request, reply) => {
  const { projectId, taskId } = request.params as { projectId: string; taskId: string }
  const userId = request.user.sub

  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  })
  if (!membership) return reply.notFound('Project not found')

  return withProjectContext(projectId, userId, async (tx) => {
    const task = await tx.task.findFirst({ where: { id: taskId, projectId } })
    if (!task) return reply.notFound('Task not found')
    return reply.send({ data: task })
  })
})
```

## React / Next.js

- Keep components focused and typed.
- Prefer server-safe code in `app/` routes and client-only code behind `'use client'`.
- Use existing styling patterns in `globals.css` and current component class naming.
- Avoid large inline utilities when a small helper improves clarity.

Example:

```tsx
type TaskCardProps = {
  title: string
  status: string
}

export function TaskCard({ title, status }: TaskCardProps) {
  return (
    <article className="rounded-lg border border-white/10 p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-zinc-400">{status}</p>
    </article>
  )
}
```

## AI Engine And Prompts

- Keep prompt modules small and composable.
- Prefer structured inputs over manual string concatenation when `PromptTemplate` or helper utilities already exist.
- Keep prompt context bounded; respect token-budget utilities in `packages/ai-engine/src/token-budgets.ts`.
- Route provider-specific behavior through the existing provider layer instead of scattering conditionals across the app.

## Database And Schema

- Prisma schema is the source of truth for models.
- Use `randomUUID()` or existing model defaults consistently with surrounding code.
- Preserve row-level isolation assumptions when changing project data access.
- Keep raw SQL scoped and parameterized unless there is a clear pgvector or migration need.

## Tests

- API tests use Vitest under `apps/api/tests/`.
- Prefer narrow tests around the changed behavior.
- When changing task lifecycle, callback, auth, or RAG logic, update the relevant API tests.
- E2E tests live in `apps/e2e/tests/` and are run against a live stack.

Example:

```ts
import { describe, expect, it } from 'vitest'

describe('task status transition', () => {
  it('returns queued immediately after task creation', async () => {
    expect('QUEUED').toBe('QUEUED')
  })
})
```

## Validation Commands

Use the current TypeScript and Docker-based commands:

```bash
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/frontend/tsconfig.json
npx tsc --noEmit -p packages/ai-engine/tsconfig.json
npx vitest run --config vitest.config.ts
BASE_URL=http://localhost:3002 npm --prefix apps/e2e run test
docker compose up -d --build
```

## Legacy Note

If you encounter references to `FastAPI`, `CrewAI`, `Celery`, `ruff`, or old Python test flows, treat them as legacy unless they are explicitly marked as a manual helper or historical note.
```
