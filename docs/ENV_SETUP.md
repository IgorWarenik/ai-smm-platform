# .env Setup Instructions

## Where API Keys Go

This project uses `.env` files for managing secrets and configuration.

### 📝 Process:

1. **Copy template:**
   ```bash
   cp .env.example .env.local
   ```

2. **Fill in your API keys** in `.env.local`:
   - ANTHROPIC_API_KEY (from https://console.anthropic.com)
   - VOYAGE_API_KEY (from https://www.voyageai.com)
   - DATABASE_URL (PostgreSQL)
   - REDIS_URL (local or cloud)
   - EMBED_CACHE_TTL_SECONDS (optional cache TTL in seconds, default 86400)
   - AGENT_RESPONSE_CACHE_TTL_SECONDS (optional Claude fallback cache TTL, default 86400)
   - CLAUDE_TOKEN_LIMIT (optional Claude token limit; `0` disables enforcement)
   - VOYAGE_TOKEN_LIMIT (optional Voyage token limit; `0` disables enforcement)
   - TOKEN_LIMIT_WINDOW_SECONDS (rolling window for token limits; `0` = lifetime counter, `86400` = daily, `2592000` = monthly)
   - AGENT_TELEMETRY_TTL_SECONDS (optional Redis TTL for agent step telemetry, default 2592000)
   - AGENT_TELEMETRY_MAX_EVENTS (optional max global telemetry events in Redis, default 10000)
   - HAIKU_SCORE_THRESHOLD (Scenario A uses Haiku when task score is below this; default 50; set to 0 to always use Sonnet)
   - MAX_TOKENS_SCORING (Claude output budget for task scoring, default 512; target 300-600)
   - MAX_TOKENS_EVALUATOR_JSON (Claude output budget for evaluator JSON, default 1024; target 800-1500)
   - MAX_EVALUATOR_CONTENT_CHARS (max content fragment passed to evaluator, default 1800)
   - MAX_TOKENS_MARKETER_BRIEF (Claude output budget for marketer briefs, default 2400; target 1500-3000)
   - MAX_TOKENS_CONTENT_GENERATION (Claude output budget for publishable deliverables, default 4096; tune by deliverable)
   - MAX_TOKENS_REVISION_DELTA (Claude output budget for revision deltas, default 1500; target 800-2000)
   - MIN_REVISION_FEEDBACK_CHARS (minimum actionable evaluator feedback size before Scenario D starts another revision, default 40)
   - RAG_MAX_CHARS_PER_CHUNK (optional RAG budget per snippet, default 1200)
   - RAG_MAX_TOTAL_CHARS (optional total RAG context budget, default 4000)
   - RAG_MIN_SIMILARITY (optional RAG relevance floor, default 0.15)
   - CLAUDE_INPUT_COST_PER_MTOKENS and CLAUDE_OUTPUT_COST_PER_MTOKENS (USD per 1M tokens for cost estimates)
   - S3 or MinIO credentials
   - COHERE_API_KEY (for speech-to-text)
   - JWT_SECRET (generate random)

### Token Monitoring

- Token counters are stored in Redis as `tokens_used:claude` and `tokens_used:voyage`.
- Fallback counters are stored as `token_fallbacks:claude` and `token_fallbacks:voyage`.
- Per-agent-step telemetry is logged to Redis list `agent_step_telemetry` and task-scoped lists `agent_step_telemetry:{taskId}`.
- Each step telemetry event includes task id, scenario, input/output tokens, RAG chars/tokens, model, latency, and cost estimate.
- Claude output budgets are split by task type instead of using one global `maxTokens`: scoring, evaluator JSON, marketer brief, content generation, and revision delta.
- RAG context is bounded with `maxCharsPerChunk`, `maxTotalChars`, and `minSimilarity` before it enters prompts.
- The API exposes Prometheus metrics at `GET /metrics`.
- When a token limit is exceeded, Claude calls fall back to cached responses for the same prompt when available; Voyage embedding calls use the embedding cache first and reject uncached requests after the limit.

3. **Never commit `.env.local`** to git:
   - It's already in `.gitignore` ✅
   - Only `.env.example` is committed (template for others)

### 🔐 Security:

- Production secrets go to CI/CD secrets manager (GitHub Actions, GitLab CI)
- `.env.local` is local-only and never pushed to repository
- Each deployment environment has its own `.env.production`, `.env.staging`

### 🔗 Related Files:

- **`.env.example`** — template with all required variables
- **`.clauderules`** — rules that Claude never reads actual secrets
- **`.gitignore`** — prevents committing real .env files
- **`SETUP.md`** — full setup instructions including environment variables
