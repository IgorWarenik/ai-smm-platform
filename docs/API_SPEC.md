# API Specification

> Source of truth: actual implementation in `apps/api/src/routes/`.
> Last synced: 2026-04-28

**Base URL:** `http://localhost:3001/api`

**Auth header:** `Authorization: Bearer <accessToken>`

---

## Authentication

### POST /auth/register

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "Ivan Petrov"
}
```

Fields:
- `email` — required, valid email
- `password` — required, min 8 chars
- `name` — optional, max 100 chars

**Response 201:**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "Ivan Petrov" },
    "tokens": { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
  }
}
```

**Response 409:** Email already in use.

---

### POST /auth/refresh

**Request:**
```json
{ "refreshToken": "eyJ..." }
```

**Response 200:**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "Ivan Petrov" },
    "tokens": { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
  }
}
```

**Response 401:** Invalid or expired refresh token / wrong token type.

Token strategy: `accessToken` expires 15 min, `refreshToken` 7 days. Each refresh rotates both. See [ADR-001](adr/001-refresh-token-strategy.md).

---

### POST /auth/login

**Request:**
```json
{ "email": "user@example.com", "password": "password123" }
```

**Response 200:**
```json
{
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "name": "Ivan Petrov" },
    "tokens": { "accessToken": "eyJ...", "refreshToken": "eyJ..." }
  }
}
```

**Response 401:** Invalid credentials.

---

### GET /auth/me

Requires auth.

**Response 200:**
```json
{
  "data": { "id": "uuid", "email": "user@example.com", "name": "Ivan Petrov", "createdAt": "ISO8601" }
}
```

---

## Projects

### GET /projects

Requires auth. Returns projects where user is a member.

**Response 200:**
```json
{
  "data": [
    { "id": "uuid", "name": "Campaign Q1", "ownerId": "uuid", "createdAt": "ISO8601" }
  ]
}
```

---

### POST /projects

**Request:**
```json
{
  "name": "Campaign Q1",
  "settings": { "language": "ru", "defaultScenario": "B" }
}
```

`settings` is optional. `defaultScenario` ∈ `A | B | C | D`.

**Response 201:** Project object.

---

### GET /projects/:projectId

**Response 200:** Project object with members.

---

### POST /projects/:projectId/members

**Request:**
```json
{ "email": "colleague@example.com", "role": "MEMBER" }
```

`role` ∈ `OWNER | MEMBER | VIEWER`.

**Response 201:** ProjectMember object.

---

### DELETE /projects/:projectId/members/:userId

Removes a member from the project. Only project owner can remove members.

**Response 204:** No content.

---

## Project Profile

### GET /projects/:projectId/profile

**Response 200:** ProjectProfile object.
**Response 204:** Profile not set yet.

---

### PUT /projects/:projectId/profile

**Request (Tier 1 required):**
```json
{
  "companyName": "ACME",
  "description": "SaaS for marketers (min 10 chars)",
  "niche": "B2B SaaS",
  "geography": "Russia"
}
```

Optional Tier 2/3 fields: `products`, `audience`, `usp`, `competitors`, `tov`, `keywords`, `forbidden`, `references`, `websiteUrl`, `socialLinks`, `kpi`, `existingContent`.

`tov` ∈ `FORMAL | FRIENDLY | BOLD | PLAYFUL | EMPATHETIC | INSPIRING`.

**Response 200:** Updated ProjectProfile object.

---

## Tasks

### POST /projects/:projectId/tasks

Requires project profile to be set first. Scoring runs asynchronously — the task is always stored and returned immediately as `QUEUED`.

**Request:**
```json
{ "input": "Create an Instagram campaign for product launch (10-5000 chars)" }
```

**Response 201** — task queued, scoring in background:
```json
{
  "data": { "id": "uuid", "status": "QUEUED", "input": "...", "createdAt": "ISO8601" }
}
```

After background scoring the status transitions to:
- `REJECTED` — score < 25
- `AWAITING_CLARIFICATION` — score 25-39 (task gets a `clarificationNote` with questions)
- `PENDING` — score ≥ 40 (execution starts automatically)

**Response 422** — project profile not set:
```json
{
  "error": "Project profile is required before executing tasks",
  "code": "PROFILE_MISSING"
}
```

---

### POST /projects/:projectId/tasks/:taskId/clarify

For tasks in `AWAITING_CLARIFICATION` status.

**Request:**
```json
{ "answer": "Target audience: women 25-35, platforms: Instagram and VK" }
```

**Response 200:** Updated task object.

---

### POST /projects/:projectId/tasks/:taskId/execute

Starts AI agent execution. Requires project profile to be set.

**Request (optional):**
```json
{ "scenario": "B" }
```

**Response 202:**
```json
{ "data": { "id": "uuid", "taskId": "uuid", "scenario": "B", "status": "RUNNING" } }
```

**Response 422** — profile missing:
```json
{ "error": "Project profile is required before executing tasks", "code": "PROFILE_MISSING" }
```

---

### GET /projects/:projectId/tasks

**Query params:** `page` (default 1), `pageSize` (default 20, max 100), `status` (optional filter).

**Response 200:**
```json
{ "data": [...], "total": 42, "page": 1, "pageSize": 20 }
```

---

### GET /projects/:projectId/tasks/:taskId

**Response 200:** Task with `executions` and `agentOutputs`.

---

### PATCH /projects/:projectId/tasks/:taskId

Updates task input. Only allowed when task is `PENDING` or `REJECTED`.

**Request:**
```json
{ "input": "Updated task description" }
```

**Response 200:** Updated task object.

---

### DELETE /projects/:projectId/tasks/:taskId

**Response 204:** No content.

---

### GET /projects/:projectId/tasks/:taskId/stream

SSE stream of task execution progress.

**Events:**
```
data: {"type":"connected","taskId":"uuid"}
data: {"type":"agent_output","agentType":"marketer","content":"..."}
data: {"type":"completed","taskId":"uuid"}
```

---

## Knowledge Base

### POST /projects/:projectId/knowledge

**Request:**
```json
{
  "category": "FRAMEWORK",
  "content": "Content text (min 1, max 10000 chars)",
  "metadata": { "title": "Brand Guide 2024", "tags": ["brand", "voice"] }
}
```

`category` ∈ `FRAMEWORK | CASE | TEMPLATE | SEO | PLATFORM_SPEC | BRAND_GUIDE`.

**Response 201:** KnowledgeItem object. Embedding generated async.

---

### GET /projects/:projectId/knowledge

Lists all knowledge items for a project with pagination.

**Query params:** `page` (default 1), `pageSize` (default 20).

**Response 200:**
```json
{
  "data": [{ "id": "uuid", "category": "BRAND_GUIDE", "content": "...", "hasEmbedding": true, "createdAt": "ISO8601" }],
  "total": 12, "page": 1, "pageSize": 20
}
```

---

### PATCH /projects/:projectId/knowledge/:itemId

**Request (at least one field required):**
```json
{ "content": "Updated text", "category": "CASE", "metadata": {} }
```

**Response 200:** Updated KnowledgeItem. Re-embedding triggered async if `content` changed.

---

### DELETE /projects/:projectId/knowledge/:itemId

**Response 204:** No content.

---

### POST /projects/:projectId/knowledge/upload

Upload a file (PDF, DOCX, DOC, MD, TXT — max 20 MB). Text is extracted, chunked (4000 chars, 200-char overlap), stored as multiple knowledge items, and embedded async.

**Request:** `multipart/form-data` with fields:
- `file` — the file
- `category` — KnowledgeCategory (default `BRAND_GUIDE`)
- `description` — optional, max 1000 chars

**Response 201:**
```json
{ "data": [...], "chunks": 3 }
```

---

### GET /projects/:projectId/knowledge/search

**Query params:**
- `q` — required, 1-500 chars
- `category` — optional filter
- `limit` — 1-20, default 5
- `maxCharsPerChunk` — 100-5000, default 1200
- `maxTotalChars` — 500-20000, default 4000
- `minSimilarity` — 0-1, default 0.15

**Response 200:**
```json
{
  "data": [{ "id": "uuid", "category": "BRAND_GUIDE", "content": "...", "similarity": 0.91 }],
  "shortlist": [...],
  "promptPack": "Compact 2-3 thesis summary for agent context"
}
```

---

## Approvals

### POST /projects/:projectId/tasks/:taskId/approvals

**Request:**
```json
{ "decision": "APPROVED", "comment": "Looks good" }
```

`decision` ∈ `APPROVED | REJECTED | REVISION_REQUESTED`.

**Response 201:** Approval object.

---

## Agent Feedback

### POST /projects/:projectId/tasks/:taskId/feedback

**Request:**
```json
{ "agentType": "marketer", "score": 4, "comment": "Good strategy" }
```

`agentType` ∈ `marketer | content_maker | evaluator`.
`score` — 1-5 integer.

**Response 201:** AgentFeedback object.

---

## Model Configuration

### GET /projects/:projectId/model-config

Returns current model provider settings. Only project members can read.

**Response 200:**
```json
{
  "data": {
    "provider": "CLAUDE",
    "apiUrl": "https://api.anthropic.com",
    "hasApiKey": true,
    "providerKeys": { "CLAUDE": true, "CHATGPT": false, "GEMINI": false, "DEEPSEEK": false },
    "envFilePath": "/repo/.env",
    "lastError": { "provider": "CHATGPT", "message": "429 quota exceeded", "timestamp": "ISO8601" }
  }
}
```

`lastError` is `null` when no recent model failure is recorded.

---

### PUT /projects/:projectId/model-config

Updates model provider, API key, and API URL. Only project owner can update.

**Request:**
```json
{ "provider": "CLAUDE", "apiKey": "sk-...", "apiUrl": "https://api.anthropic.com" }
```

`provider` ∈ `CLAUDE | CHATGPT | DEEPSEEK | GEMINI`.
`apiKey` is optional if the key is already stored for that provider.

**Response 200:** Updated config (same shape as GET, no key returned).

---

### POST /projects/:projectId/model-config/test

Sends a live test prompt to the configured model and returns the result.

**Request (optional — defaults to currently saved config):**
```json
{ "provider": "CLAUDE", "apiKey": "sk-...", "apiUrl": "https://api.anthropic.com" }
```

**Response 200:**
```json
{
  "data": { "ok": true, "provider": "CLAUDE", "message": "OK", "latencyMs": 412 }
}
```

`ok: false` on provider error — `message` contains the error text.

---

## Internal (n8n → API)

### POST /api/internal/agent-completion

Called by n8n workflows to invoke Claude via API.

**Request:** `{ "systemPrompt": "...", "userMessage": "...", ... }`

**Response 200:** `{ "content": "..." }`

---

### POST /api/internal/callback

Called by n8n to save agent output and emit SSE event.

**Request:** AgentResultCallback schema (see `packages/shared/src/schemas.ts`).

---

### POST /api/internal/execution-complete

Called by n8n when full execution finishes.

---

## Metrics

### GET /metrics

Prometheus text format. No auth required.

Metrics exposed:
- `ai_tokens_used_total{provider, model}`
- `ai_token_limit{provider}`
- `ai_token_cost_estimate_usd_total{provider}`
- `ai_tokens_used_by_operation_total{operation}`

---

## Error Format

All manual errors use:
```json
{
  "error": "Human readable message",
  "code": "SCREAMING_SNAKE_CODE",
  "details": { "field": "value" }
}
```

Fastify-sensible errors (`notFound`, `unauthorized`, `badRequest`, etc.) use:
```json
{ "statusCode": 404, "error": "Not Found", "message": "Task not found" }
```

> ⚠️ GAP-004: error format not yet unified across all routes.

---

## Data Models (actual DB schema)

### User
```typescript
{ id, email, passwordHash, name, role, createdAt, updatedAt }
```

### Project
```typescript
{ id, name, ownerId, settings, createdAt, updatedAt }
```

### Task
```typescript
{
  id, projectId, input, score, scenario,
  status: QUEUED | PENDING | AWAITING_CLARIFICATION | REJECTED | RUNNING | AWAITING_APPROVAL | COMPLETED | FAILED,
  clarificationNote, rejectedAt, createdAt, updatedAt
}
```

### Execution
```typescript
{ id, taskId, projectId, scenario, status, createdAt, updatedAt }
```

### AgentOutput
```typescript
{ id, executionId, agentType, output, iteration, evalScore, status, createdAt }
```
