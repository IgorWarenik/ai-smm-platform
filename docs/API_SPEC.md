# API Specification

> Source of truth: actual implementation in `apps/api/src/routes/`.
> Last synced: 2026-04-19

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

**Request:**
```json
{ "input": "Create an Instagram campaign for product launch (10-5000 chars)" }
```

**Response 201** — task accepted:
```json
{
  "data": { "id": "uuid", "status": "PENDING", "score": 72, "scenario": "D", ... },
  "scoring": {
    "score": 72,
    "scenario": "D",
    "reasoning": "Detailed task with clear objective...",
    "isValid": true
  }
}
```

**Response 202** — clarification needed (score 25-39):
```json
{
  "data": { "id": "uuid", "status": "AWAITING_CLARIFICATION", ... },
  "message": "Task requires clarification before it can be processed",
  "clarificationQuestions": ["What is the target audience?", "What platforms?"]
}
```

**Response 422** — score < 25:
```json
{
  "error": "Task rejected",
  "code": "TASK_SCORE_TOO_LOW",
  "details": { "score": "12", "threshold": "25", "reasoning": "Too vague..." }
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

**Query params:** `page` (default 1), `pageSize` (default 20, max 100).

**Response 200:**
```json
{ "data": [...], "total": 42, "page": 1, "pageSize": 20 }
```

---

### GET /projects/:projectId/tasks/:taskId

**Response 200:** Task with `executions` and `agentOutputs`.

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
  "content": "Content text (min 1, max 50000 chars)",
  "metadata": { "title": "Brand Guide 2024", "tags": ["brand", "voice"] }
}
```

`category` ∈ `FRAMEWORK | CASE | TEMPLATE | SEO | PLATFORM_SPEC | BRAND_GUIDE`.

**Response 201:** KnowledgeItem object. Embedding generated async.

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
  status: PENDING | AWAITING_CLARIFICATION | REJECTED | RUNNING | COMPLETED | FAILED,
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
