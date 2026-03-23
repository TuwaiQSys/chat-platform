// In-memory rate limiter (Redis upgrade path available)
// Tracks message count per user with sliding window

interface RateEntry {
  count: number
  windowStart: number
}

const limits = new Map<string, RateEntry>()

const WINDOW_MS = 10_000 // 10 second window
const MAX_MESSAGES = 5   // 5 messages per window (adjustable per risk tier)

export function checkRateLimit(userId: string, maxPerWindow?: number): {
  allowed: boolean
  remaining: number
  retryAfter?: number
} {
  const max = maxPerWindow ?? MAX_MESSAGES
  const now = Date.now()
  const entry = limits.get(userId)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    limits.set(userId, { count: 1, windowStart: now })
    return { allowed: true, remaining: max - 1 }
  }

  if (entry.count >= max) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000)
    return { allowed: false, remaining: 0, retryAfter }
  }

  entry.count++
  return { allowed: true, remaining: max - entry.count }
}

// Cleanup old entries every 30s
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS * 2
  for (const [key, entry] of limits) {
    if (entry.windowStart < cutoff) limits.delete(key)
  }
}, 30_000)
