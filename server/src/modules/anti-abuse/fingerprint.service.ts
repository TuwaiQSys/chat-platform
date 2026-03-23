import crypto from 'crypto'
import { Fingerprint } from './fingerprint.model.js'

export interface ClientSignals {
  screenRes?: string
  timezone?: string
  language?: string
  platform?: string
  webglRenderer?: string
}

export function computeHash(ip: string, userAgent: string, signals: ClientSignals): string {
  const raw = [
    ip,
    userAgent,
    signals.screenRes || '',
    signals.timezone || '',
    signals.language || '',
    signals.platform || '',
    signals.webglRenderer || '',
  ].join('|')

  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32)
}

export async function recordFingerprint(
  userId: string,
  ip: string,
  userAgent: string,
  signals: ClientSignals,
) {
  const hash = computeHash(ip, userAgent, signals)

  await Fingerprint.create({
    userId,
    hash,
    signals: { ip, userAgent, ...signals },
  })

  return hash
}

export async function checkBanEvasion(hash: string, excludeUserId: string): Promise<{
  evasionDetected: boolean
  matchedUserIds: string[]
}> {
  const matches = await Fingerprint.find({ hash, userId: { $ne: excludeUserId } })
    .distinct('userId')

  // Check if any matched users are banned
  if (matches.length === 0) return { evasionDetected: false, matchedUserIds: [] }

  // Import here to avoid circular dependency
  const { User } = await import('../identity/user.model.js')
  const bannedUsers = await User.find({ _id: { $in: matches }, status: 'banned' })

  return {
    evasionDetected: bannedUsers.length > 0,
    matchedUserIds: bannedUsers.map((u) => u._id.toString()),
  }
}
