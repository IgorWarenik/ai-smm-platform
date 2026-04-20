import { createClient, RedisClientType } from 'redis'

const REDIS_URL = process.env.REDIS_URL

let redisClient: RedisClientType | null = null
let redisEnabled = REDIS_URL != null

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (!redisEnabled) return null
  if (redisClient) return redisClient

  try {
    redisClient = createClient({ url: REDIS_URL })
    redisClient.on('error', (err) => {
      console.warn('Redis error:', err)
      redisEnabled = false
    })
    await redisClient.connect()
    return redisClient
  } catch (err) {
    console.warn('Redis connection failed:', err)
    redisEnabled = false
    redisClient = null
    return null
  }
}

