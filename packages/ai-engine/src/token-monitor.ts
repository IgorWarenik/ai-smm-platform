import { createHash } from 'crypto'
import { getRedisClient } from './redis'

export type TokenProvider = 'claude' | 'voyage'

export interface TokenUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens: number
  /** Tokens written to Anthropic prompt cache (billed at 1.25× input rate). */
  cacheCreationTokens?: number
  /** Tokens read from Anthropic prompt cache (billed at 0.1× input rate). */
  cacheReadTokens?: number
  model?: string
  operation?: string
  cacheHit?: boolean
  fallbackUsed?: boolean
}

export interface AgentStepTelemetry {
  taskId?: string
  projectId?: string
  scenario?: string
  provider: TokenProvider
  operation: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
  ragChars: number
  ragTokens: number
  latencyMs: number
  costEstimateUsd: number
  cacheHit?: boolean
  fallbackUsed?: boolean
  timestamp: string
}

export interface AgentStepTelemetryInput {
  taskId?: string
  scenario?: string
  ragChars?: number
  ragTokens?: number
}

export class TokenLimitExceededError extends Error {
  constructor(
    public readonly provider: TokenProvider,
    public readonly limit: number,
    public readonly used: number
  ) {
    super(`${provider} token limit exceeded: ${used}/${limit}`)
    this.name = 'TokenLimitExceededError'
  }
}

const PROVIDERS: TokenProvider[] = ['claude', 'voyage']
const DEFAULT_LIMITS: Record<TokenProvider, number> = {
  claude: Number(process.env.CLAUDE_TOKEN_LIMIT ?? 500_000),
  voyage: Number(process.env.VOYAGE_TOKEN_LIMIT ?? 250_000),
}
const CACHE_TTL_SECONDS = Number(process.env.AGENT_RESPONSE_CACHE_TTL_SECONDS ?? 86_400)
const TELEMETRY_TTL_SECONDS = Number(process.env.AGENT_TELEMETRY_TTL_SECONDS ?? 2_592_000)
const TELEMETRY_MAX_EVENTS = Number(process.env.AGENT_TELEMETRY_MAX_EVENTS ?? 10_000)
const CLAUDE_INPUT_COST_PER_MTOKENS = Number(process.env.CLAUDE_INPUT_COST_PER_MTOKENS ?? 0)
const CLAUDE_OUTPUT_COST_PER_MTOKENS = Number(process.env.CLAUDE_OUTPUT_COST_PER_MTOKENS ?? 0)
/**
 * When > 0, token counters expire after this many seconds and reset automatically.
 * Use to enforce daily (86400) or monthly (2592000) limits instead of lifetime caps.
 * Default 0 = no expiry (lifetime counter).
 */
const TOKEN_LIMIT_WINDOW_SECONDS = Number(process.env.TOKEN_LIMIT_WINDOW_SECONDS ?? 0)

function counterKey(provider: TokenProvider): string {
  return `tokens_used:${provider}`
}

function fallbackKey(provider: TokenProvider): string {
  return `token_fallbacks:${provider}`
}

function costKey(provider: TokenProvider): string {
  return `token_cost_estimate_usd_micros:${provider}`
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4))
}

export function estimateTextTokens(text: string): number {
  return estimateTokens(text)
}

export function makeCacheKey(provider: TokenProvider, parts: string[]): string {
  const digest = createHash('sha256').update(parts.join('\n---\n')).digest('hex')
  return `${provider}:response:${digest}`
}

export async function getCachedResponse(key: string): Promise<string | null> {
  const client = await getRedisClient()
  if (!client) return null
  return client.get(key)
}

export async function setCachedResponse(key: string, value: string): Promise<void> {
  const client = await getRedisClient()
  if (!client) return
  await client.set(key, value, { EX: CACHE_TTL_SECONDS })
}

export async function getTokensUsed(provider: TokenProvider): Promise<number> {
  const client = await getRedisClient()
  if (!client) return 0
  const raw = await client.get(counterKey(provider))
  return raw ? Number(raw) : 0
}

export async function assertTokenBudget(
  provider: TokenProvider,
  estimatedTokens = 0
): Promise<void> {
  const limit = DEFAULT_LIMITS[provider]
  if (limit <= 0) return

  const used = await getTokensUsed(provider)
  if (used + estimatedTokens > limit) {
    throw new TokenLimitExceededError(provider, limit, used + estimatedTokens)
  }
}

export async function recordTokenUsage(
  provider: TokenProvider,
  usage: TokenUsage
): Promise<void> {
  const client = await getRedisClient()
  if (!client) {
    console.info('token_usage', { provider, ...usage })
    return
  }

  const total = Math.max(0, Math.floor(usage.totalTokens))
  if (total > 0) {
    const newVal = await client.incrBy(counterKey(provider), total)
    // If a rolling window is configured and this is the first write in the window,
    // set an expiry so the counter auto-resets (daily/monthly limit semantics).
    if (TOKEN_LIMIT_WINDOW_SECONDS > 0 && newVal === total) {
      await client.expire(counterKey(provider), TOKEN_LIMIT_WINDOW_SECONDS)
    }
  }
  await client.hIncrBy(`token_usage:${provider}:by_model`, usage.model ?? 'unknown', total)
  await client.hIncrBy(`token_usage:${provider}:by_operation`, usage.operation ?? 'unknown', total)

  console.info('token_usage', { provider, ...usage })
}

export function estimateCostUsd(
  provider: TokenProvider,
  inputTokens: number,
  outputTokens = 0,
  cacheCreationTokens = 0,
  cacheReadTokens = 0
): number {
  if (provider !== 'claude') return 0
  // Cache creation: 1.25× input rate. Cache read: 0.1× input rate.
  return (
    (inputTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_MTOKENS +
    (outputTokens / 1_000_000) * CLAUDE_OUTPUT_COST_PER_MTOKENS +
    (cacheCreationTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_MTOKENS * 1.25 +
    (cacheReadTokens / 1_000_000) * CLAUDE_INPUT_COST_PER_MTOKENS * 0.1
  )
}

export async function recordAgentStepTelemetry(
  event: AgentStepTelemetry
): Promise<void> {
  const client = await getRedisClient()
  console.info('agent_step_telemetry', event)

  if (!client) return

  const serialized = JSON.stringify(event)
  await client.lPush('agent_step_telemetry', serialized)
  await client.lTrim('agent_step_telemetry', 0, TELEMETRY_MAX_EVENTS - 1)
  await client.expire('agent_step_telemetry', TELEMETRY_TTL_SECONDS)

  if (event.taskId) {
    const taskKey = `agent_step_telemetry:${event.taskId}`
    await client.lPush(taskKey, serialized)
    await client.expire(taskKey, TELEMETRY_TTL_SECONDS)
  }

  if (event.projectId && event.totalTokens > 0) {
    await client.incrBy(`tokens_used:project:${event.projectId}`, event.totalTokens)
  }

  const micros = Math.round(event.costEstimateUsd * 1_000_000)
  if (micros > 0) {
    await client.incrBy(costKey(event.provider), micros)
  }
}

const INFLIGHT_LOCK_TTL_SECONDS = 30
const INFLIGHT_POLL_INTERVAL_MS = 300
const INFLIGHT_POLL_TIMEOUT_MS = 25_000

/**
 * Try to acquire an in-flight lock for a cache key.
 * Returns true if the lock was acquired (this caller should make the API request).
 * Returns false if another request already holds the lock (caller should poll cache).
 */
export async function acquireInflightLock(cacheKey: string): Promise<boolean> {
  const client = await getRedisClient()
  if (!client) return true // no Redis → no deduplication, proceed normally
  const lockKey = `inflight:${cacheKey}`
  const result = await client.set(lockKey, '1', { NX: true, EX: INFLIGHT_LOCK_TTL_SECONDS })
  return result === 'OK'
}

/**
 * Release an in-flight lock after the API response has been cached.
 */
export async function releaseInflightLock(cacheKey: string): Promise<void> {
  const client = await getRedisClient()
  if (!client) return
  await client.del(`inflight:${cacheKey}`)
}

/**
 * Poll the exact-match cache until a result appears or timeout is reached.
 * Used by requests that lost the in-flight lock race.
 * Returns null if timeout expires without a cached result.
 */
export async function pollCacheUntilAvailable(cacheKey: string): Promise<string | null> {
  const deadline = Date.now() + INFLIGHT_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, INFLIGHT_POLL_INTERVAL_MS))
    const result = await getCachedResponse(cacheKey)
    if (result !== null) return result
  }
  return null
}

export async function recordTokenFallback(provider: TokenProvider): Promise<void> {
  const client = await getRedisClient()
  if (!client) return
  await client.incr(fallbackKey(provider))
}

export function extractClaudeUsage(response: unknown): TokenUsage {
  const usage = (response as {
    usage?: {
      input_tokens?: number
      output_tokens?: number
      cache_creation_input_tokens?: number
      cache_read_input_tokens?: number
    }
  }).usage
  const inputTokens = usage?.input_tokens ?? 0
  const outputTokens = usage?.output_tokens ?? 0
  const cacheCreationTokens = usage?.cache_creation_input_tokens ?? 0
  const cacheReadTokens = usage?.cache_read_input_tokens ?? 0
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    ...(cacheCreationTokens > 0 && { cacheCreationTokens }),
    ...(cacheReadTokens > 0 && { cacheReadTokens }),
  }
}

export function extractVoyageUsage(response: unknown, input: string | string[]): TokenUsage {
  const usage = (response as {
    usage?: { total_tokens?: number; prompt_tokens?: number }
    total_tokens?: number
  }).usage

  const estimated = Array.isArray(input)
    ? input.reduce((sum, item) => sum + estimateTokens(item), 0)
    : estimateTokens(input)

  const totalTokens =
    usage?.total_tokens ??
    usage?.prompt_tokens ??
    (response as { total_tokens?: number }).total_tokens ??
    estimated

  return { inputTokens: totalTokens, totalTokens }
}

export async function getTokenMetricsSnapshot(): Promise<Record<TokenProvider, {
  used: number
  limit: number
  fallbackCount: number
  costEstimateUsd: number
  byOperation: Record<string, number>
}>> {
  const client = await getRedisClient()
  const snapshot = {} as Record<TokenProvider, {
    used: number
    limit: number
    fallbackCount: number
    costEstimateUsd: number
    byOperation: Record<string, number>
  }>

  for (const provider of PROVIDERS) {
    const used = await getTokensUsed(provider)
    const fallbackRaw = client ? await client.get(fallbackKey(provider)) : null
    const costRaw = client ? await client.get(costKey(provider)) : null
    const byOperationRaw = client ? await client.hGetAll(`token_usage:${provider}:by_operation`) : {}
    const byOperation = Object.fromEntries(
      Object.entries(byOperationRaw ?? {}).map(([operation, value]) => [operation, Number(value)])
    )
    snapshot[provider] = {
      used,
      limit: DEFAULT_LIMITS[provider],
      fallbackCount: fallbackRaw ? Number(fallbackRaw) : 0,
      costEstimateUsd: costRaw ? Number(costRaw) / 1_000_000 : 0,
      byOperation,
    }
  }

  return snapshot
}

function escapePrometheusLabelValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/"/g, '\\"')
}

export async function renderTokenPrometheusMetrics(): Promise<string> {
  const snapshot = await getTokenMetricsSnapshot()
  const lines = [
    '# HELP ai_tokens_used_total Total LLM and embedding tokens used.',
    '# TYPE ai_tokens_used_total counter',
  ]

  for (const provider of PROVIDERS) {
    lines.push(`ai_tokens_used_total{provider="${provider}"} ${snapshot[provider].used}`)
  }

  lines.push('# HELP ai_token_limit Configured token limit by provider.')
  lines.push('# TYPE ai_token_limit gauge')
  for (const provider of PROVIDERS) {
    lines.push(`ai_token_limit{provider="${provider}"} ${snapshot[provider].limit}`)
  }

  lines.push('# HELP ai_token_fallbacks_total Number of token-limit fallbacks.')
  lines.push('# TYPE ai_token_fallbacks_total counter')
  for (const provider of PROVIDERS) {
    lines.push(`ai_token_fallbacks_total{provider="${provider}"} ${snapshot[provider].fallbackCount}`)
  }

  lines.push('# HELP ai_token_cost_estimate_usd_total Estimated token cost in USD.')
  lines.push('# TYPE ai_token_cost_estimate_usd_total counter')
  for (const provider of PROVIDERS) {
    lines.push(`ai_token_cost_estimate_usd_total{provider="${provider}"} ${snapshot[provider].costEstimateUsd}`)
  }

  lines.push('# HELP ai_tokens_used_by_operation_total Total tokens used by provider and operation.')
  lines.push('# TYPE ai_tokens_used_by_operation_total counter')
  for (const provider of PROVIDERS) {
    for (const [operation, total] of Object.entries(snapshot[provider].byOperation)) {
      lines.push(
        `ai_tokens_used_by_operation_total{provider="${provider}",operation="${escapePrometheusLabelValue(operation)}"} ${total}`
      )
    }
  }

  return `${lines.join('\n')}\n`
}
