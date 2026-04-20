---
created: "2026-04-20T00:00:00Z"
last_edited: "2026-04-20T00:00:00Z"
complexity: complex
---

# Cavekit: Knowledge Base and RAG

## Scope
Per-project repository of structured reference material (frameworks, cases, templates, SEO notes, platform specs, brand guides) and the semantic search surface that agents consult during task execution. Covers item creation, listing, and similarity search with explicit budget controls for retrieval.

## Requirements

### R1: Knowledge Item Creation
**Description:** A member can add a knowledge item of a recognized category with content and optional metadata.
**Acceptance Criteria:**
- [ ] Member request with a valid category and non-empty content returns a success status and creates the item in the project scope.
- [ ] category must be one of {FRAMEWORK, CASE, TEMPLATE, SEO, PLATFORM_SPEC, BRAND_GUIDE}; other values return HTTP 400.
- [ ] Non-member request returns HTTP 404.
- [ ] The item is persisted immediately; embedding computation runs asynchronously and does not block the write.
- [ ] An embedding failure does not delete or fail the item write.
**Dependencies:** cavekit-projects R6

### R2: Knowledge Item Listing
**Description:** A member can list the knowledge items belonging to a project.
**Acceptance Criteria:**
- [ ] Member request returns items whose project_id matches the addressed project.
- [ ] Non-member request returns HTTP 404.
- [ ] Items from other projects never appear in the response.
- [ ] [GAP] Pagination semantics (default page size, cursor vs offset) are not specified in source docs.
**Dependencies:** R1

### R3: Project Isolation
**Description:** Knowledge is strictly scoped to the owning project; no automatic cross-project sharing takes place.
**Acceptance Criteria:**
- [ ] Every read and search query filters by the project id of the addressed project.
- [ ] A knowledge item created in project A is never returned when searching in project B.
- [ ] [GAP] Architecture docs describe FRAMEWORK items as globally shared across projects, but the implementation scopes them per-project.
**Dependencies:** R1, R2

### R4: Semantic Search
**Description:** A member can query the knowledge base with a natural language string and receive items ranked by semantic similarity.
**Acceptance Criteria:**
- [ ] Request with q between 1 and 500 characters returns HTTP 200 with { data, shortlist, promptPack }.
- [ ] Request with q missing, empty, or over 500 characters returns HTTP 400.
- [ ] An optional category filter restricts results to that category.
- [ ] limit is between 1 and 20 and defaults to 5; values outside the range return HTTP 400.
- [ ] Non-member request returns HTTP 404.
- [ ] A malformed or injection-style category value returns HTTP 400 and never reaches the database.
**Dependencies:** R1, R3

### R5: Retrieval Budget Enforcement
**Description:** Search enforces explicit budgets on chunk size, total character count, and minimum similarity.
**Acceptance Criteria:**
- [ ] maxCharsPerChunk is between 100 and 5000 and defaults to 1200; returned items are trimmed to this length.
- [ ] maxTotalChars is between 500 and 20000 and defaults to 4000; the cumulative content in the response does not exceed it.
- [ ] minSimilarity is between 0 and 1 and defaults to 0.72; items below this similarity are excluded from the response.
- [ ] Out-of-range budget parameters return HTTP 400.
- [ ] The promptPack string concatenates the shortlist items within the maxTotalChars ceiling.
**Dependencies:** R4

### R6: Embedding Cache
**Description:** Embeddings for repeated queries are served from a shared cache to avoid redundant vector API calls.
**Acceptance Criteria:**
- [ ] A repeated identical search query within the cache TTL produces no additional outbound embedding calls for the query text.
- [ ] A cache miss triggers an embedding computation and writes the result to the cache.
- [ ] Cache lookups happen before every outbound embedding call.
**Dependencies:** R4, cavekit-tokens R3

## Out of Scope
- Update or delete endpoints for knowledge items ([GAP] not present in current code)
- File upload and automatic chunking of large documents
- Global or cross-project knowledge sharing
- Server-side deduplication of identical search calls within one execution (handled at workflow level)
- Human-curated review of ingested items

## Source Traceability
- apps/api/src/routes/knowledge.ts
- apps/api/tests/unit/knowledge.test.ts
- apps/api/prisma/schema.prisma (KnowledgeItem)

## Cross-References
- See also: cavekit-projects.md
- See also: cavekit-orchestration.md (RAG fetched once per execution)
- See also: cavekit-tokens.md (embedding budget and cache)

## Changelog
- 2026-04-20: Initial brownfield reverse-engineering
