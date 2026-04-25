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

export type ModelProvider = 'CLAUDE' | 'DEEPSEEK' | 'CHATGPT' | 'GEMINI'

type AgentUsage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens: number
  cacheCreationTokens?: number
  cacheReadTokens?: number
}

const PROVIDER_DEFAULTS: Record<ModelProvider, { model: string; apiKeyEnv: string; apiUrlEnv: string; apiUrl: string }> = {
  CLAUDE: {
    model: 'claude-sonnet-4-6',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiUrlEnv: 'ANTHROPIC_API_URL',
    apiUrl: 'https://api.anthropic.com',
  },
  DEEPSEEK: {
    model: 'deepseek-chat',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    apiUrlEnv: 'DEEPSEEK_API_URL',
    apiUrl: 'https://api.deepseek.com',
  },
  CHATGPT: {
    model: 'gpt-4o-mini',
    apiKeyEnv: 'OPENAI_API_KEY',
    apiUrlEnv: 'OPENAI_API_URL',
    apiUrl: 'https://api.openai.com/v1',
  },
  GEMINI: {
    model: 'gemini-flash-latest',
    apiKeyEnv: 'GEMINI_API_KEY',
    apiUrlEnv: 'GEMINI_API_URL',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
}

function normalizeModelProvider(value?: string): ModelProvider {
  const provider = value?.toUpperCase()
  return provider === 'DEEPSEEK' || provider === 'CHATGPT' || provider === 'GEMINI' || provider === 'CLAUDE'
    ? provider
    : 'CLAUDE'
}

function getModelProvider(): ModelProvider {
  return normalizeModelProvider(process.env.MODEL_PROVIDER)
}

function getAnthropicClient(config = getProviderConfig('CLAUDE')) {
  return new Anthropic({
    apiKey: config.apiKey,
    baseURL: config.apiUrl === PROVIDER_DEFAULTS.CLAUDE.apiUrl ? undefined : config.apiUrl,
  })
}

function getProviderConfig(provider: ModelProvider) {
  const defaults = PROVIDER_DEFAULTS[provider]
  const selectedProvider = getModelProvider()
  return {
    apiKey: process.env[defaults.apiKeyEnv] || (selectedProvider === provider ? process.env.MODEL_API_KEY : undefined),
    apiUrl: process.env[defaults.apiUrlEnv] || (selectedProvider === provider ? process.env.MODEL_API_URL : undefined) || defaults.apiUrl,
    model: selectedProvider === provider && process.env.MODEL_NAME ? process.env.MODEL_NAME : defaults.model,
  }
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

function getGeminiModelPath(model: string): string {
  return model.startsWith('models/') ? model : `models/${model}`
}

function buildGeminiPrompt(systemPrompt: string, userMessage: string): string {
  return `${systemPrompt}\n\n${userMessage}`
}

function buildGeminiEndpoint(params: {
  apiUrl: string
  apiKey: string
  model: string
  action: 'generateContent' | 'streamGenerateContent'
  stream?: boolean
}): string {
  const [rawUrl, rawQuery = ''] = params.apiUrl.split('?')
  const trimmedUrl = rawUrl.replace(/\/+$/, '')
  const endpoint = /:(generateContent|streamGenerateContent)$/.test(trimmedUrl)
    ? trimmedUrl.replace(/:(generateContent|streamGenerateContent)$/, `:${params.action}`)
    : joinUrl(trimmedUrl, `/${getGeminiModelPath(params.model)}:${params.action}`)
  const query = new URLSearchParams(rawQuery)
  if (params.stream) query.set('alt', 'sse')
  query.set('key', params.apiKey)
  return `${endpoint}?${query.toString()}`
}

async function parseJsonResponse(response: Response): Promise<any> {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { raw: text }
  }
}

async function runOpenAICompatible(params: {
  provider: ModelProvider
  apiKey: string
  apiUrl: string
  model: string
  maxTokens: number
  systemPrompt: string
  userMessage: string
}) {
  const endpoint = params.apiUrl.endsWith('/chat/completions')
    ? params.apiUrl
    : joinUrl(params.apiUrl, '/chat/completions')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userMessage },
      ],
    }),
  })
  const json = await parseJsonResponse(response)
  if (!response.ok) {
    throw new Error(`${params.provider} API error ${response.status}: ${JSON.stringify(json)}`)
  }
  const output = json.choices?.[0]?.message?.content
  if (typeof output !== 'string') {
    throw new Error(`${params.provider} returned no message content`)
  }
  return {
    output,
    usage: {
      inputTokens: Number(json.usage?.prompt_tokens ?? estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage)),
      outputTokens: Number(json.usage?.completion_tokens ?? estimateTextTokens(output)),
      totalTokens: Number(json.usage?.total_tokens ?? estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage) + estimateTextTokens(output)),
    },
  }
}

async function runGemini(params: {
  apiKey: string
  apiUrl: string
  model: string
  maxTokens: number
  systemPrompt: string
  userMessage: string
}) {
  const endpoint = buildGeminiEndpoint({
    apiUrl: params.apiUrl,
    apiKey: params.apiKey,
    model: params.model,
    action: 'generateContent',
  })
  const prompt = buildGeminiPrompt(params.systemPrompt, params.userMessage)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  })
  const json = await parseJsonResponse(response)
  if (!response.ok) {
    throw new Error(`GEMINI API error ${response.status}: ${JSON.stringify(json)}`)
  }
  const output = json.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('')
  if (typeof output !== 'string' || output.length === 0) {
    throw new Error('GEMINI returned no message content')
  }
  return {
    output,
    usage: {
      inputTokens: Number(json.usageMetadata?.promptTokenCount ?? estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage)),
      outputTokens: Number(json.usageMetadata?.candidatesTokenCount ?? estimateTextTokens(output)),
      totalTokens: Number(json.usageMetadata?.totalTokenCount ?? estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage) + estimateTextTokens(output)),
    },
  }
}

function estimateUsage(params: { systemPrompt: string; userMessage: string; output: string }): AgentUsage {
  const inputTokens = estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage)
  const outputTokens = estimateTextTokens(params.output)
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  }
}

async function* readSseData(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Streaming response has no body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() ?? ''

    for (const event of events) {
      const data = event
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n')
      if (data) yield data
    }
  }

  buffer += decoder.decode()
  if (buffer.trim()) {
    const data = buffer
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (data) yield data
  }
}

async function runOpenAICompatibleStreaming(params: {
  provider: ModelProvider
  apiKey: string
  apiUrl: string
  model: string
  maxTokens: number
  systemPrompt: string
  userMessage: string
  onChunk: (chunk: string) => void
}) {
  const endpoint = params.apiUrl.endsWith('/chat/completions')
    ? params.apiUrl
    : joinUrl(params.apiUrl, '/chat/completions')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify({
      model: params.model,
      max_tokens: params.maxTokens,
      stream: true,
      ...(params.provider === 'CHATGPT' && { stream_options: { include_usage: true } }),
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userMessage },
      ],
    }),
  })

  if (!response.ok) {
    const json = await parseJsonResponse(response)
    throw new Error(`${params.provider} API error ${response.status}: ${JSON.stringify(json)}`)
  }

  let output = ''
  let usage: AgentUsage | null = null

  for await (const data of readSseData(response)) {
    if (data === '[DONE]') break
    const json = JSON.parse(data)
    const chunk = json.choices?.[0]?.delta?.content
    if (typeof chunk === 'string' && chunk.length > 0) {
      output += chunk
      params.onChunk(chunk)
    }
    if (json.usage) {
      usage = {
        inputTokens: Number(json.usage.prompt_tokens ?? 0),
        outputTokens: Number(json.usage.completion_tokens ?? 0),
        totalTokens: Number(json.usage.total_tokens ?? 0),
      }
    }
  }

  return {
    output,
    usage: usage ?? estimateUsage({
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      output,
    }),
  }
}

async function runGeminiStreaming(params: {
  apiKey: string
  apiUrl: string
  model: string
  maxTokens: number
  systemPrompt: string
  userMessage: string
  onChunk: (chunk: string) => void
}) {
  const endpoint = buildGeminiEndpoint({
    apiUrl: params.apiUrl,
    apiKey: params.apiKey,
    model: params.model,
    action: 'streamGenerateContent',
    stream: true,
  })
  const prompt = buildGeminiPrompt(params.systemPrompt, params.userMessage)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  })

  if (!response.ok) {
    const json = await parseJsonResponse(response)
    throw new Error(`GEMINI API error ${response.status}: ${JSON.stringify(json)}`)
  }

  let output = ''
  let usage: AgentUsage | null = null

  for await (const data of readSseData(response)) {
    const json = JSON.parse(data)
    const chunk = json.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .join('')
    if (typeof chunk === 'string' && chunk.length > 0) {
      output += chunk
      params.onChunk(chunk)
    }
    if (json.usageMetadata) {
      usage = {
        inputTokens: Number(json.usageMetadata.promptTokenCount ?? 0),
        outputTokens: Number(json.usageMetadata.candidatesTokenCount ?? 0),
        totalTokens: Number(json.usageMetadata.totalTokenCount ?? 0),
      }
    }
  }

  return {
    output,
    usage: usage ?? estimateUsage({
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      output,
    }),
  }
}

/**
 * Run a single agent completion (non-streaming).
 */
export async function runAgent(params: {
  systemPrompt: string
  userMessage: string
  provider?: ModelProvider
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
  const provider = normalizeModelProvider(params.provider ?? process.env.MODEL_PROVIDER)
  const providerConfig = getProviderConfig(provider)
  const model = params.model ?? providerConfig.model
  const telemetryModel = `${provider}:${model}`
  const maxTokens = params.maxTokens ?? getTokenBudgetForOperation(params.operation)
  const cacheKey = makeCacheKey('claude', [provider, model, params.systemPrompt, params.userMessage])
  const semanticCacheKey = params.semanticCacheKey
    ? makeCacheKey('claude', ['semantic', provider, model, hashCachePart(params.semanticCacheKey)])
    : null
  const estimatedTokens =
    estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage) + maxTokens

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
      model: telemetryModel,
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
        model: telemetryModel,
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
    let usage: AgentUsage

    if (provider === 'CLAUDE') {
      const systemParam = params.cacheSystemPrompt
        ? ([{ type: 'text', text: params.systemPrompt, cache_control: { type: 'ephemeral' } }] as Anthropic.TextBlockParam[])
        : params.systemPrompt
      const response = await getAnthropicClient(providerConfig).messages.create({
        model,
        max_tokens: maxTokens,
        system: systemParam,
        messages: [{ role: 'user', content: params.userMessage }],
      })
      const block = response.content[0]
      output = block.type === 'text' ? block.text : ''
      usage = extractClaudeUsage(response)
    } else {
      if (!providerConfig.apiKey) {
        throw new Error(`${provider} API key is not configured`)
      }
      const result = provider === 'GEMINI'
        ? await runGemini({
            apiKey: providerConfig.apiKey,
            apiUrl: providerConfig.apiUrl,
            model,
            maxTokens,
            systemPrompt: params.systemPrompt,
            userMessage: params.userMessage,
          })
        : await runOpenAICompatible({
            provider,
            apiKey: providerConfig.apiKey,
            apiUrl: providerConfig.apiUrl,
            model,
            maxTokens,
            systemPrompt: params.systemPrompt,
            userMessage: params.userMessage,
          })
      output = result.output
      usage = result.usage
    }

    await recordTokenUsage('claude', {
      ...usage,
      model: telemetryModel,
      operation: params.operation ?? 'runAgent',
    })
    await recordAgentStepTelemetry({
      taskId: params.telemetry?.taskId,
      projectId: params.telemetry?.projectId,
      scenario: params.telemetry?.scenario,
      provider: 'claude',
      operation: params.operation ?? 'runAgent',
      model: telemetryModel,
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
 * Run an agent completion with streaming.
 * Calls onChunk for each text delta, returns the full text when done.
 */
export async function runAgentStreaming(params: {
  systemPrompt: string
  userMessage: string
  onChunk: (chunk: string) => void
  provider?: ModelProvider
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
  const provider = normalizeModelProvider(params.provider ?? process.env.MODEL_PROVIDER)
  const providerConfig = getProviderConfig(provider)
  const model = params.model ?? providerConfig.model
  const telemetryModel = `${provider}:${model}`
  const maxTokens = params.maxTokens ?? getTokenBudgetForOperation(params.operation)
  const cacheKey = makeCacheKey('claude', [provider, model, params.systemPrompt, params.userMessage])
  const semanticCacheKey = params.semanticCacheKey
    ? makeCacheKey('claude', ['semantic', provider, model, hashCachePart(params.semanticCacheKey)])
    : null
  const estimatedTokens =
    estimateTextTokens(params.systemPrompt) + estimateTextTokens(params.userMessage) + maxTokens

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
      model: telemetryModel,
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
        model: telemetryModel,
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

  let usage: AgentUsage | null = null

  if (provider === 'CLAUDE') {
    let finalUsage: unknown = null
    const systemParam = params.cacheSystemPrompt
      ? ([{ type: 'text', text: params.systemPrompt, cache_control: { type: 'ephemeral' } }] as Anthropic.TextBlockParam[])
      : params.systemPrompt
    const stream = getAnthropicClient(providerConfig).messages.stream({
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
    usage = finalUsage
      ? extractClaudeUsage(finalUsage)
      : estimateUsage({
          systemPrompt: params.systemPrompt,
          userMessage: params.userMessage,
          output: fullText,
        })
  } else {
    if (!providerConfig.apiKey) {
      throw new Error(`${provider} API key is not configured`)
    }
    const result = provider === 'GEMINI'
      ? await runGeminiStreaming({
          apiKey: providerConfig.apiKey,
          apiUrl: providerConfig.apiUrl,
          model,
          maxTokens,
          systemPrompt: params.systemPrompt,
          userMessage: params.userMessage,
          onChunk: params.onChunk,
        })
      : await runOpenAICompatibleStreaming({
          provider,
          apiKey: providerConfig.apiKey,
          apiUrl: providerConfig.apiUrl,
          model,
          maxTokens,
          systemPrompt: params.systemPrompt,
          userMessage: params.userMessage,
          onChunk: params.onChunk,
        })
    fullText = result.output
    usage = result.usage
  }

  if (usage) {
    await recordTokenUsage('claude', {
      ...usage,
      model: telemetryModel,
      operation: params.operation ?? 'runAgentStreaming',
    })
    await recordAgentStepTelemetry({
      taskId: params.telemetry?.taskId,
      projectId: params.telemetry?.projectId,
      scenario: params.telemetry?.scenario,
      provider: 'claude',
      operation: params.operation ?? 'runAgentStreaming',
      model: telemetryModel,
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
