import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null
    return Math.min(times * 200, 2000)
  },
  lazyConnect: true,
})

export async function connectRedis() {
  try {
    await redis.connect()
    console.log('Redis connected')
  } catch (err) {
    console.warn('Redis unavailable, falling back to in-memory:', (err as Error).message)
  }
}
