import mongoose from 'mongoose'
import { ModerationAction, type ModerationActionType, ACTION_PERMISSION_MAP } from './moderation-action.model.js'
import { Member } from '../rooms/member.model.js'
import { User } from '../identity/user.model.js'
import { Message } from '../messages/message.model.js'
import { Fingerprint } from '../anti-abuse/fingerprint.model.js'
import { hasPermission, canModerateUser } from '../roles/role.service.js'
import { logAction } from '../audit/audit.service.js'

interface ModActionParams {
  type: ModerationActionType
  targetUserId: string
  moderatorId: string
  roomId?: string
  reason: string
  duration?: number        // minutes, 0 = permanent
  ipAddress?: string       // for IP bans
  fingerprintHash?: string // for fingerprint bans
}

export async function canPerformAction(
  moderatorId: string,
  targetUserId: string,
  actionType: ModerationActionType,
): Promise<{ allowed: boolean; reason?: string }> {
  if (moderatorId === targetUserId) return { allowed: false, reason: 'لا يمكنك تنفيذ هذا الإجراء على نفسك' }

  // Check priority — can't moderate someone with equal or higher priority
  const canMod = await canModerateUser(moderatorId, targetUserId)
  if (!canMod) return { allowed: false, reason: 'لا تملك صلاحية كافية (الهدف بدور أعلى)' }

  // Check specific permission for this action
  const requiredPermission = ACTION_PERMISSION_MAP[actionType]
  if (!requiredPermission) return { allowed: false, reason: 'نوع الإجراء غير معروف' }

  const hasPerm = await hasPermission(moderatorId, requiredPermission)
  if (!hasPerm) return { allowed: false, reason: 'لا تملك صلاحية هذا الإجراء' }

  return { allowed: true }
}

export async function executeModAction(params: ModActionParams) {
  const { type, targetUserId, moderatorId, roomId, reason, duration, ipAddress, fingerprintHash } = params

  const check = await canPerformAction(moderatorId, targetUserId, type)
  if (!check.allowed) return { error: check.reason }

  const expiresAt = duration && duration > 0
    ? new Date(Date.now() + duration * 60 * 1000)
    : undefined

  // Deactivate previous actions of same type for same target/scope
  const deactivateFilter: Record<string, unknown> = { targetUserId, type, active: true }
  if (roomId) deactivateFilter.roomId = roomId
  else deactivateFilter.roomId = { $exists: false }
  await ModerationAction.updateMany(deactivateFilter, { active: false })

  // For IP bans, auto-resolve IP from user if not provided
  let resolvedIp = ipAddress
  if (type === 'ban.ip' && !resolvedIp) {
    const target = await User.findById(targetUserId)
    resolvedIp = target?.lastIp || undefined
  }

  // For fingerprint bans, auto-resolve from latest fingerprint
  let resolvedFingerprint = fingerprintHash
  if ((type === 'ban.fingerprint' || type === 'ban.layered') && !resolvedFingerprint) {
    const fp = await Fingerprint.findOne({ userId: targetUserId }).sort({ createdAt: -1 })
    resolvedFingerprint = fp?.hash || undefined
  }

  const action = await ModerationAction.create({
    type,
    targetUserId,
    roomId: roomId || undefined,
    moderatorId,
    reason,
    duration,
    expiresAt,
    active: true,
    ipAddress: resolvedIp,
    fingerprintHash: resolvedFingerprint,
    metadata: type === 'ban.layered' ? { ip: resolvedIp, fingerprint: resolvedFingerprint } : undefined,
  })

  // Apply side effects
  if (type === 'kick.room' && roomId) {
    await Member.deleteOne({ roomId, userId: targetUserId })
  }

  if (type === 'kick.global') {
    await Member.deleteMany({ userId: targetUserId })
  }

  if (type.startsWith('mute.') && type.endsWith('.room') && roomId) {
    await Member.updateOne(
      { roomId, userId: targetUserId },
      { roomRole: 'muted', mutedUntil: expiresAt || new Date('2099-12-31') },
    )
  }

  if (type === 'ban.room' && roomId) {
    await Member.deleteOne({ roomId, userId: targetUserId })
  }

  if (type === 'ban.global' || type === 'ban.ip' || type === 'ban.fingerprint' || type === 'ban.layered') {
    await User.updateOne({ _id: targetUserId }, { status: 'banned', bannedUntil: expiresAt })
    await Member.deleteMany({ userId: targetUserId })
  }

  await logAction({
    actionType: `moderation.${type}`,
    actorId: moderatorId,
    targetId: targetUserId,
    targetType: 'user',
    roomId,
    reason,
    metadata: { duration, expiresAt, ipAddress: resolvedIp, fingerprintHash: resolvedFingerprint },
  })

  return { action }
}

export async function isUserMuted(userId: string, roomId: string, muteType?: 'text' | 'voice' | 'both'): Promise<boolean> {
  const member = await Member.findOne({ roomId, userId })
  if (!member) return false
  if (member.roomRole !== 'muted') return false
  if (member.mutedUntil && member.mutedUntil < new Date()) {
    await Member.updateOne({ roomId, userId }, { roomRole: 'member', mutedUntil: undefined })
    return false
  }
  return true
}

export async function isUserBanned(userId: string, roomId?: string): Promise<boolean> {
  const user = await User.findById(userId)
  if (!user) return true
  if (user.status === 'banned') {
    if (user.bannedUntil && user.bannedUntil < new Date()) {
      await User.updateOne({ _id: userId }, { status: 'active', bannedUntil: undefined })
      return false
    }
    return true
  }

  if (roomId) {
    const ban = await ModerationAction.findOne({
      targetUserId: userId,
      roomId,
      type: 'ban.room',
      active: true,
    })
    if (ban) {
      if (ban.expiresAt && ban.expiresAt < new Date()) {
        await ModerationAction.updateOne({ _id: ban._id }, { active: false })
        return false
      }
      return true
    }
  }

  return false
}

export async function isIpBanned(ip: string): Promise<boolean> {
  if (!ip) return false
  const ban = await ModerationAction.findOne({
    type: { $in: ['ban.ip', 'ban.layered'] },
    ipAddress: ip,
    active: true,
  })
  if (!ban) return false
  if (ban.expiresAt && ban.expiresAt < new Date()) {
    await ModerationAction.updateOne({ _id: ban._id }, { active: false })
    return false
  }
  return true
}

export async function isFingerprintBanned(hash: string): Promise<boolean> {
  if (!hash) return false
  const ban = await ModerationAction.findOne({
    type: { $in: ['ban.fingerprint', 'ban.layered'] },
    fingerprintHash: hash,
    active: true,
  })
  if (!ban) return false
  if (ban.expiresAt && ban.expiresAt < new Date()) {
    await ModerationAction.updateOne({ _id: ban._id }, { active: false })
    return false
  }
  return true
}

export async function isShadowBanned(userId: string, roomId?: string): Promise<boolean> {
  // Shadow ban not in the new granular types — can be added if needed
  return false
}

export async function deleteMessage(messageId: string, moderatorId: string, reason: string) {
  const msg = await Message.findById(messageId)
  if (!msg) return { error: 'الرسالة غير موجودة' }

  const hasPerm = await hasPermission(moderatorId, 'mod.delete_message')
  if (!hasPerm) return { error: 'لا تملك صلاحية حذف الرسائل' }

  await Message.updateOne({ _id: messageId }, { status: 'deleted' })

  await logAction({
    actionType: 'moderation.message.delete',
    actorId: moderatorId,
    targetId: messageId,
    targetType: 'message',
    roomId: msg.roomId.toString(),
    reason,
  })

  return { success: true, roomId: msg.roomId.toString() }
}

// Get all available mod actions for a moderator against a target
export async function getAvailableActions(
  moderatorId: string,
  targetUserId: string,
): Promise<string[]> {
  if (moderatorId === targetUserId) return []

  const canMod = await canModerateUser(moderatorId, targetUserId)
  if (!canMod) return []

  const { getUserPermissions } = await import('../roles/role.service.js')
  const perms = await getUserPermissions(moderatorId)

  // Return all mod.* permissions the moderator has
  return perms.filter((p) => p.startsWith('mod.'))
}
