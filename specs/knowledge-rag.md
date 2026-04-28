title: Knowledge base and RAG
status: approved
priority: high
last_updated: 2026-04-28

## Scope
- `apps/api/src/routes/knowledge.ts`
- `packages/ai-engine/src/embeddings.ts`
- `packages/ai-engine/src/rag.ts`
- `packages/shared/src/schemas.ts`
- `packages/db/prisma/schema.prisma`
- `packages/db/migrations/001_rls_policies.sql`

## Goal
Store project knowledge, embed it with Voyage AI, and retrieve compact relevant context for agents without leaking data across projects.

## Public Contract
- Knowledge routes live under `/api/projects/:projectId/knowledge`.
- Create knowledge item: `POST /knowledge` accepts `category`, `content` (max 10000 chars), and optional `metadata`.
- List: `GET /knowledge` returns paginated items with `hasEmbedding` flag.
- Search: `GET /knowledge/search?q=...&category=...&limit=...` returns raw `data` plus compact `shortlist` and `promptPack`.
- PATCH: `PATCH /knowledge/:itemId` updates `content`, `category`, or `metadata`; re-embeds async if content changed.
- DELETE: `DELETE /knowledge/:itemId` removes item.
- Upload: `POST /knowledge/upload` accepts `multipart/form-data` with a file (PDF, DOCX, DOC, MD, TXT; max 20 MB). Text is extracted, chunked at 4000 chars with 200-char overlap, stored as separate knowledge items, embedded async.
- Search returns project-scoped items ordered by vector similarity.
- Search applies RAG budget before returning prompt context: `maxCharsPerChunk`, `maxTotalChars`, and `minSimilarity`.
- `promptPack` is built by a shared helper in `packages/ai-engine`, not duplicated in workflows.
- For multi-step executions, RAG retrieval happens once per execution and later agent steps reuse a compact prompt pack instead of repeating the same search.
- Embeddings use Voyage `voyage-3-lite` and pgvector dimension 1024.
- Redis embedding cache must be checked before calling Voyage.

## Acceptance Criteria
- Knowledge item creation stores content even if async embedding fails.
- Embedding failures are logged as warnings (`app.log.warn`) and do not lose the original knowledge item.
- Search never returns data from another project.
- Search limit is capped by Zod validation.
- Voyage calls go through `packages/ai-engine/src/embeddings.ts` so token monitoring, Redis counters, and token limits apply.
- RAG formatting sends only relevant knowledge snippets to prompts.
- RAG snippets below `minSimilarity` are excluded, each snippet is trimmed to `maxCharsPerChunk`, and the final context never exceeds `maxTotalChars`.
- Two-stage RAG is used for agent prompts: retrieval shortlist first, then a lightweight prompt pack with 2-3 compact theses.
- Scenario B/D do not issue duplicate `knowledge/search` requests for the same `executionId` and `input`.
- File upload supports PDF, DOCX, DOC, MD, TXT; unsupported types return 400.
- Chunked upload items include `title` and `sourceFile` in metadata.

## Examples
```json
{
  "createKnowledgeItem": {
    "category": "CASE",
    "content": "Case study: Telegram launch campaign...",
    "metadata": {
      "title": "Telegram launch",
      "source": "internal",
      "tags": ["telegram", "launch"]
    }
  },
  "search": {
    "q": "telegram launch campaign",
    "category": "CASE",
    "limit": 5
  }
}
```

## Context Rules
- For RAG changes, include `embeddings.ts`, `rag.ts`, `knowledge.ts`, shared schemas, and the Prisma `KnowledgeItem` contract.
- Do not include agent prompt files unless changing how retrieved context is inserted into prompts.
