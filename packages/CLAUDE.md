# Packages

Shared workspace packages.

## Conventions
- `packages/shared/` owns shared enums, types, and Zod schemas.
- `packages/db/` owns Prisma schema, migrations, client helpers, and RLS utilities.
- `packages/ai-engine/` owns LLM calls, embeddings, RAG, Redis, token budgets, and telemetry.
- Cross-package API changes should update the relevant Cavekit kit and tests together.
