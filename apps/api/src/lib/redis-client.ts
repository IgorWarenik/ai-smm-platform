import { Redis } from 'ioredis'

let client: Redis | null = null

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url) return null
  if (client) return client

  client = new Redis(url, { enableOfflineQueue: false, lazyConnect: false })
  client.on('error', (err) => {
    console.warn('[redis-client] connection error:', err.message)
  })
  return client
}

export const MODEL_LAST_ERROR_KEY = 'model:last_error'
export const MODEL_LAST_ERROR_TTL = 86400
