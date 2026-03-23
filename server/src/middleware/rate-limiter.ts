import { getAntiAbuseConfig } from '../modules/anti-abuse/anti-abuse-config.model.js'
import crypto from 'crypto'

interface RateEntry {
  count: number
  windowStart: number
}

interface DuplicateEntry {
  hashes: string[]
  timestamps: number[]
}

const rateLimits = new Map<string, RateEntry>()
const duplicates = new Map<string, DuplicateEntry>()

export async function checkRateLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
  retryAfter?: number
}> {
  const config = await getAntiAbuseConfig()
  const windowMs = config.globalFloodWindowSeconds * 1000
  const max = config.globalFloodLimit

  const now = Date.now()
  const entry = rateLimits.get(userId)

  if (!entry || now - entry.windowStart > windowMs) {
    rateLimits.set(userId, { count: 1, windowStart: now })
    return { allowed: true, remaining: max - 1 }
  }

  if (entry.count >= max) {
    const retryAfter = Math.ceil((windowMs - (now - entry.windowStart)) / 1000)
    return { allowed: false, remaining: 0, retryAfter }
  }

  entry.count++
  return { allowed: true, remaining: max - entry.count }
}

export async function checkDuplicateMessage(userId: string, content: string): Promise<boolean> {
  const config = await getAntiAbuseConfig()
  if (!config.duplicateMessageWindow || config.duplicateMessageWindow <= 0) return false

  const windowMs = config.duplicateMessageWindow * 1000
  const now = Date.now()
  const hash = crypto.createHash('md5').update(content).digest('hex')

  const entry = duplicates.get(userId)
  if (!entry) {
    duplicates.set(userId, { hashes: [hash], timestamps: [now] })
    return false
  }

  // Clean old entries
  const cutoff = now - windowMs
  const validIndices: number[] = []
  for (let i = 0; i < entry.timestamps.length; i++) {
    if (entry.timestamps[i] > cutoff) validIndices.push(i)
  }
  entry.hashes = validIndices.map((i) => entry.hashes[i])
  entry.timestamps = validIndices.map((i) => entry.timestamps[i])

  // Check for duplicate
  if (entry.hashes.includes(hash)) return true

  entry.hashes.push(hash)
  entry.timestamps.push(now)
  return false
}

// Cleanup every 30s
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimits) {
    if (now - entry.windowStart > 60_000) rateLimits.delete(key)
  }
  for (const [key, entry] of duplicates) {
    if (entry.timestamps.length === 0 || now - entry.timestamps[entry.timestamps.length - 1] > 60_000) {
      duplicates.delete(key)
    }
  }
}, 30_000)
