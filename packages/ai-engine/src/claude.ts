import Anthropic from '@anthropic-ai/sdk'
import {
  assertTokenBudget,
  estimateTextTokens,
  extractClaudeUsage,
  estimateCostUsd,
  getCachedResponse,
  makeCacheKey,
  recordAgentStepTelemetry,
  recordTokenFallback,
  recordTokenUsage,
  setCachedResponse,
  acquireInflightLock,
  releaseInflightLock,
  pollCacheUntilAvailable,
} from './token-monitor'
import { hashCachePart } from './semantic-cache'
import { getTokenBudgetForOperation } from './token-budgets'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const DEFAULT_MODEL = 'claude-sonnet-4-6'

/**
 * Run a single Claude completion (non-streaming).
 */
export async function runAgent(params: {
  systemPrompt: string
  userMessage: string
  model?: string
  maxTokens?: number
  operation?: string
  semanticCacheKey?: string
  /**
   * When true, the system prompt is passed as a cacheable content block
   * (cache_control: ephemeral, TTL 5 min). Useful for multi-iteration scenarios
   * (D) where the same system prompt repeats. Min 1024 tokens for Sonnet.
   */
  cacheSystemPrompt?: boolean
  telemetry?: {
    taskId?: string
    projectId?: string
    scenario?: string
    ragChars?: number
    ragTokens?: number
  }
  /** Called with actual token counts after a successful (non-cached) API response. */
  onUsage?: (usage: { inputTokens: number; outputTokens: number; totalTokens: number }) => Promise<void>
}): Promise<string> {
  const startedAt = Date.now()
  const model = params.model ?? DEFAULT_MODEL
  const maxTokens = params.maxTokens ?? getTokenBudgetForOperation(params.operation)
  const cacheKey = makeCacheKey('claude', [model, params.systemPrompt, params.userMessage])
  const semanticCacheKey = params.semanticCacheKey
    ? makeCacheKey('claude', ['semantic', hashCachePart(params.semanticCacheKey)])
    : null
  const estimatedTokens =
    estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage) + maxTokens

  // Build system param: cacheable array or plain string
  const systemParam = params.cacheSystemPrompt
    ? ([{ type: 'text', text: params.systemPrompt, cache_control: { type: 'ephemeral' } }] as Anthropic.TextBlockParam[])
    : params.systemPrompt

  // Check Redis cache before spending tokens — covers retries of failed tasks
  // and identical requests within the response cache TTL window.
  const earlyCache = await getCachedResponse(cacheKey)
  if (earlyCache) {
    const inputTokens = estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage)
    const outputTokens = estimateTextTokens(earlyCache)
    await recordAgentStepTelemetry({
      taskId: params.telemetry?.taskId,
      projectId: params.telemetry?.projectId,
      scenario: params.telemetry?.scenario,
      provider: 'claude',
      operation: params.operation ?? 'runAgent',
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      ragChars: params.telemetry?.ragChars ?? 0,
      ragTokens: params.telemetry?.ragTokens ?? 0,
      latencyMs: Date.now() - startedAt,
      costEstimateUsd: 0,
      cacheHit: true,
      timestamp: new Date().toISOString(),
    })
    return earlyCache
  }

  if (semanticCacheKey) {
    const semanticCache = await getCachedResponse(semanticCacheKey)
    if (semanticCache) {
      const inputTokens = estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage)
      const outputTokens = estimateTextTokens(semanticCache)
      await recordAgentStepTelemetry({
        taskId: params.telemetry?.taskId,
        projectId: params.telemetry?.projectId,
        scenario: params.telemetry?.scenario,
        provider: 'claude',
        operation: params.operation ?? 'runAgent',
        model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        ragChars: params.telemetry?.ragChars ?? 0,
        ragTokens: params.telemetry?.ragTokens ?? 0,
        latencyMs: Date.now() - startedAt,
        costEstimateUsd: 0,
        cacheHit: true,
        timestamp: new Date().toISOString(),
      })
      await setCachedResponse(cacheKey, semanticCache)
      return semanticCache
    }
  }

  try {
    await assertTokenBudget('claude', estimatedTokens)
  } catch (err) {
    await recordTokenFallback('claude')
    const fallbackCache = semanticCacheKey ? await getCachedResponse(semanticCacheKey) : null
    if (fallbackCache) {
      return fallbackCache
    }
    throw err
  }

  // In-flight deduplication: if another request with the same key is already in progress,
  // poll the cache instead of making a redundant API call.
  const lockAcquired = await acquireInflightLock(cacheKey)
  if (!lockAcquired) {
    const polledResult = await pollCacheUntilAvailable(cacheKey)
    if (polledResult !== null) return polledResult
    // Timeout — fall through and make the API call ourselves
  }

  let output = ''
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemParam,
      messages: [{ role: 'user', content: params.userMessage }],
    })

    const block = response.content[0]
    output = block.type === 'text' ? block.text : ''
    const usage = extractClaudeUsage(response)

    await recordTokenUsage('claude', {
      ...usage,
      model,
      operation: params.operation ?? 'runAgent',
    })
    await recordAgentStepTelemetry({
      taskId: params.telemetry?.taskId,
      projectId: params.telemetry?.projectId,
      scenario: params.telemetry?.scenario,
      provider: 'claude',
      operation: params.operation ?? 'runAgent',
      model,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens,
      cacheCreationTokens: usage.cacheCreationTokens,
      cacheReadTokens: usage.cacheReadTokens,
      ragChars: params.telemetry?.ragChars ?? 0,
      ragTokens: params.telemetry?.ragTokens ?? 0,
      latencyMs: Date.now() - startedAt,
      costEstimateUsd: estimateCostUsd(
        'claude',
        usage.inputTokens ?? 0,
        usage.outputTokens ?? 0,
        usage.cacheCreationTokens,
        usage.cacheReadTokens,
      ),
      timestamp: new Date().toISOString(),
    })
    await setCachedResponse(cacheKey, output)
    if (semanticCacheKey) {
      await setCachedResponse(semanticCacheKey, output)
    }

    if (params.onUsage) {
      await params.onUsage({
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens,
      })
    }
  } finally {
    if (lockAcquired) {
      await releaseInflightLock(cacheKey)
    }
  }

  return output
}

/**
 * Run a Claude completion with streaming.
 * Calls onChunk for each text delta, returns the full text when done.
 */
export async function runAgentStreaming(params: {
  systemPrompt: string
  userMessage: string
  onChunk: (chunk: string) => void
  model?: string
  maxTokens?: number
  operation?: string
  semanticCacheKey?: string
  /** See runAgent for details. */
  cacheSystemPrompt?: boolean
  telemetry?: {
    taskId?: string
    projectId?: string
    scenario?: string
    ragChars?: number
    ragTokens?: number
  }
  /** Called with actual token counts after a successful (non-cached) stream completes. */
  onUsage?: (usage: { inputTokens: number; outputTokens: number; totalTokens: number }) => Promise<void>
}): Promise<string> {
  const startedAt = Date.now()
  let fullText = ''
  let finalUsage: unknown = null
  const model = params.model ?? DEFAULT_MODEL
  const maxTokens = params.maxTokens ?? getTokenBudgetForOperation(params.operation)
  const cacheKey = makeCacheKey('claude', [model, params.systemPrompt, params.userMessage])
  const semanticCacheKey = params.semanticCacheKey
    ? makeCacheKey('claude', ['semantic', hashCachePart(params.semanticCacheKey)])
    : null
  const estimatedTokens =
    estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage) + maxTokens

  const systemParam = params.cacheSystemPrompt
    ? ([{ type: 'text', text: params.systemPrompt, cache_control: { type: 'ephemeral' } }] as Anthropic.TextBlockParam[])
    : params.systemPrompt

  // Check Redis cache before spending tokens.
  const earlyCache = await getCachedResponse(cacheKey)
  if (earlyCache) {
    params.onChunk(earlyCache)
    const inputTokens = estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage)
    const outputTokens = estimateTextTokens(earlyCache)
    await recordAgentStepTelemetry({
      taskId: params.telemetry?.taskId,
      projectId: params.telemetry?.projectId,
      scenario: params.telemetry?.scenario,
      provider: 'claude',
      operation: params.operation ?? 'runAgentStreaming',
      model,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      ragChars: params.telemetry?.ragChars ?? 0,
      ragTokens: params.telemetry?.ragTokens ?? 0,
      latencyMs: Date.now() - startedAt,
      costEstimateUsd: 0,
      cacheHit: true,
      timestamp: new Date().toISOString(),
    })
    return earlyCache
  }

  if (semanticCacheKey) {
    const semanticCache = await getCachedResponse(semanticCacheKey)
    if (semanticCache) {
      params.onChunk(semanticCache)
      const inputTokens = estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage)
      const outputTokens = estimateTextTokens(semanticCache)
      await recordAgentStepTelemetry({
        taskId: params.telemetry?.taskId,
        projectId: params.telemetry?.projectId,
        scenario: params.telemetry?.scenario,
        provider: 'claude',
        operation: params.operation ?? 'runAgentStreaming',
        model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        ragChars: params.telemetry?.ragChars ?? 0,
        ragTokens: params.telemetry?.ragTokens ?? 0,
        latencyMs: Date.now() - startedAt,
        costEstimateUsd: 0,
        cacheHit: true,
        timestamp: new Date().toISOString(),
      })
      await setCachedResponse(cacheKey, semanticCache)
      return semanticCache
    }
  }

  try {
    await assertTokenBudget('claude', estimatedTokens)
  } catch (err) {
    await recordTokenFallback('claude')
    const fallbackCache = semanticCacheKey ? await getCachedResponse(semanticCacheKey) : null
    if (fallbackCache) {
      params.onChunk(fallbackCache)
      return fallbackCache
    }
    throw err
  }

  const stream = anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemParam,
    messages: [{ role: 'user', content: params.userMessage }],
  })

  for await (const event of stream as AsyncIterable<any>) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      const chunk = event.delta.text
      fullText += chunk
      params.onChunk(chunk)
    }
    if (event.type === 'message_delta' && event.usage) {
      finalUsage = { usage: event.usage }
    }
    if (event.type === 'message_stop' && event.message?.usage) {
      finalUsage = event.message
    }
  }

  if (finalUsage) {
    const usage = extractClaudeUsage(finalUsage)
    await recordTokenUsage('claude', {
      ...usage,
      model,
      operation: params.operation ?? 'runAgentStreaming',
    })
    await recordAgentStepTelemetry({
      taskId: params.telemetry?.taskId,
      projectId: params.telemetry?.projectId,
      scenario: params.telemetry?.scenario,
      provider: 'claude',
      operation: params.operation ?? 'runAgentStreaming',
      model,
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      totalTokens: usage.totalTokens,
      cacheCreationTokens: usage.cacheCreationTokens,
      cacheReadTokens: usage.cacheReadTokens,
      ragChars: params.telemetry?.ragChars ?? 0,
      ragTokens: params.telemetry?.ragTokens ?? 0,
      latencyMs: Date.now() - startedAt,
      costEstimateUsd: estimateCostUsd(
        'claude',
        usage.inputTokens ?? 0,
        usage.outputTokens ?? 0,
        usage.cacheCreationTokens,
        usage.cacheReadTokens,
      ),
      timestamp: new Date().toISOString(),
    })
    if (params.onUsage) {
      await params.onUsage({
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens,
      })
    }
  }
  await setCachedResponse(cacheKey, fullText)
  if (semanticCacheKey) {
    await setCachedResponse(semanticCacheKey, fullText)
  }

  return fullText
}
