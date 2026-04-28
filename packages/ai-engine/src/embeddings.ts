import { createHash } from 'crypto'
import { VoyageAIClient } from 'voyageai'
import { getRedisClient } from './redis'
import {
  assertTokenBudget,
  estimateTextTokens,
  extractVoyageUsage,
  recordTokenFallback,
  recordTokenUsage,
  TokenLimitExceededError,
} from './token-monitor'

const EMBEDDING_DIMENSIONS = 512
const EMBEDDING_MODEL = 'voyage-3-lite'
const CACHE_TTL_SECONDS = Number(process.env.EMBED_CACHE_TTL_SECONDS ?? 86400)

function getVoyageClient() {
  return new VoyageAIClient({
    apiKey: process.env.VOYAGE_API_KEY ?? '',
  })
}

function getCacheKey(text: string): string {
  const digest = createHash('sha256').update(text).digest('hex')
  return `embed:${EMBEDDING_MODEL}:${digest}`
}

async function getCachedEmbedding(key: string): Promise<number[] | null> {
  const client = await getRedisClient()
  if (!client) return null

  try {
    const raw = await client.get(key)
    if (!raw) return null
    return JSON.parse(raw) as number[]
  } catch (err) {
    console.warn('Failed to read embed cache:', err)
    return null
  }
}

async function setCachedEmbedding(key: string, embedding: number[]): Promise<void> {
  const client = await getRedisClient()
  if (!client) return

  try {
    await client.set(key, JSON.stringify(embedding), {
      EX: CACHE_TTL_SECONDS,
    })
  } catch (err) {
    console.warn('Failed to write embed cache:', err)
  }
}

// voyage-3-lite produces 512-dimensional vectors.
// Ensure your pgvector column is: embedding vector(512)
export { EMBEDDING_DIMENSIONS }

/**
 * Embed a single text string using Voyage AI voyage-3-lite.
 * voyage-3-lite: cheaper, great for retrieval tasks.
 * voyage-3: higher quality, ~2x cost.
 */
async function embedTextOnce(text: string): Promise<number[]> {
  await assertTokenBudget('voyage', estimateTextTokens(text)).catch(async (err) => {
    if (err instanceof TokenLimitExceededError) {
      await recordTokenFallback('voyage')
    }
    throw err
  })

  const response = await getVoyageClient().embed({
    input: text,
    model: EMBEDDING_MODEL,
  })
  await recordTokenUsage('voyage', {
    ...extractVoyageUsage(response, text),
    model: EMBEDDING_MODEL,
    operation: 'embedText',
  })
  const embedding = response.data?.[0]?.embedding
  if (!embedding) throw new Error('Voyage embedText returned no embedding data')
  return embedding
}

export async function embedText(text: string): Promise<number[]> {
  const cacheKey = getCacheKey(text)
  const cached = await getCachedEmbedding(cacheKey)
  if (cached) return cached

  // Retry up to 3 times on 429 with exponential backoff (1s, 3s, 9s)
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const embedding = await embedTextOnce(text)
      await setCachedEmbedding(cacheKey, embedding)
      return embedding
    } catch (err: any) {
      lastErr = err
      const is429 = err?.statusCode === 429 || err?.message?.includes('429')
      if (!is429 || attempt === 2) throw err
      await new Promise(r => setTimeout(r, 1000 * Math.pow(3, attempt)))
    }
  }
  throw lastErr
}

/**
 * Embed multiple texts in a single API call.
 * More efficient than calling embedText in a loop.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []

  const client = await getRedisClient()
  const result: number[][] = new Array(texts.length)
  const cacheKeys = texts.map(getCacheKey)

  const toFetch: { text: string; indexes: number[]; key: string }[] = []

  if (client) {
    const cachedValues = await client.mGet(cacheKeys)
    for (let index = 0; index < texts.length; index += 1) {
      const key = cacheKeys[index]
      const cached = cachedValues[index]
      if (cached) {
        result[index] = JSON.parse(cached) as number[]
      } else {
        const existing = toFetch.find((item) => item.key === key)
        if (existing) {
          existing.indexes.push(index)
        } else {
          toFetch.push({ text: texts[index], indexes: [index], key })
        }
      }
    }
  } else {
    for (let index = 0; index < texts.length; index += 1) {
      toFetch.push({ text: texts[index], indexes: [index], key: cacheKeys[index] })
    }
  }

  if (toFetch.length > 0) {
    const chunkSize = 100
    for (let offset = 0; offset < toFetch.length; offset += chunkSize) {
      const chunk = toFetch.slice(offset, offset + chunkSize)
      const input = chunk.map((item) => item.text)

      await assertTokenBudget(
        'voyage',
        input.reduce((sum, item) => sum + estimateTextTokens(item), 0)
      ).catch(async (err) => {
        if (err instanceof TokenLimitExceededError) {
          await recordTokenFallback('voyage')
        }
        throw err
      })

      const response = await getVoyageClient().embed({ input, model: EMBEDDING_MODEL })
      await recordTokenUsage('voyage', {
        ...extractVoyageUsage(response, input),
        model: EMBEDDING_MODEL,
        operation: 'embedBatch',
      })

      for (let i = 0; i < chunk.length; i += 1) {
        const embedding = response.data?.[i]?.embedding
        if (!embedding) {
          throw new Error(`Voyage embedBatch returned no embedding data for index ${i}`)
        }
        const { indexes, key } = chunk[i]
        for (const index of indexes) {
          result[index] = embedding
        }
        await setCachedEmbedding(key, embedding)
      }
    }
  }

  return result
}
