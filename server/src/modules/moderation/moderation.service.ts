import mongoose from 'mongoose'
import { ModerationAction, type ModerationActionType } from './moderation-action.model.js'
import { Member } from '../rooms/member.model.js'
import { User } from '../identity/user.model.js'
import { Message } from '../messages/message.model.js'
import { logAction } from '../audit/audit.service.js'

interface ModActionParams {
  type: ModerationActionType
  targetUserId: string
  moderatorId: string
  roomId?: string
  reason: string
  duration?: number // minutes, 0 = permanent
}

// Permission hierarchy: admin > moderator > user
const ROLE_PRIORITY: Record<string, number> = { admin: 100, moderator: 50, user: 0 }

export async function canModerate(
  moderatorId: string,
  targetUserId: string,
  action: ModerationActionType,
  roomId?: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const moderator = await User.findById(moderatorId)
  const target = await User.findById(targetUserId)
  if (!moderator || !target) return { allowed: false, reason: 'المستخدم غير موجود' }

  // Can't moderate yourself
  if (moderatorId === targetUserId) return { allowed: false, reason: 'لا يمكنك تنفيذ هذا الإجراء على نفسك' }

  const modPriority = ROLE_PRIORITY[moderator.systemRole] ?? 0
  const targetPriority = ROLE_PRIORITY[target.systemRole] ?? 0

  // Can't moderate someone with equal or higher role
  if (targetPriority >= modPriority) return { allowed: false, reason: 'لا تملك صلاحية كافية' }

  // Global actions (ban, shadow_ban) require admin
  if (!roomId && ['ban', 'shadow_ban'].includes(action)) {
    if (moderator.systemRole !== 'admin') return { allowed: false, reason: 'الحظر الشامل يتطلب صلاحية مسؤول' }
  }

  // Room-level checks
  if (roomId) {
    const modMember = await Member.findOne({ roomId, userId: moderatorId })
    if (!modMember) return { allowed: false, reason: 'لست عضوًا في هذه الغرفة' }

    // Room moderators can mute/kick, but only admins can ban
    if (['mute', 'kick', 'warn', 'message_removed'].includes(action)) {
      if (!['owner', 'moderator'].includes(modMember.roomRole) && moderator.systemRole === 'user') {
        return { allowed: false, reason: 'لا تملك صلاحية في هذه الغرفة' }
      }
    }

    if (['ban', 'shadow_ban'].includes(action)) {
      if (modMember.roomRole !== 'owner' && moderator.systemRole !== 'admin') {
        return { allowed: false, reason: 'الحظر يتطلب صلاحية مالك الغرفة أو مسؤول' }
      }
    }
  }

  return { allowed: true }
}

export async function executeModAction(params: ModActionParams) {
  const { type, targetUserId, moderatorId, roomId, reason, duration } = params

  const check = await canModerate(moderatorId, targetUserId, type, roomId)
  if (!check.allowed) return { error: check.reason }

  const expiresAt = duration && duration > 0
    ? new Date(Date.now() + duration * 60 * 1000)
    : undefined

  // Deactivate previous actions of same type for same target/room
  await ModerationAction.updateMany(
    { targetUserId, type, roomId: roomId || { $exists: false }, active: true },
    { active: false },
  )

  const action = await ModerationAction.create({
    type,
    targetUserId,
    roomId: roomId || undefined,
    moderatorId,
    reason,
    expiresAt,
    active: true,
  })

  // Apply side effects
  switch (type) {
    case 'mute':
      if (roomId) {
        await Member.updateOne(
          { roomId, userId: targetUserId },
          { roomRole: 'muted', mutedUntil: expiresAt || new Date('2099-12-31') },
        )
      }
      break

    case 'ban':
      if (roomId) {
        await Member.deleteOne({ roomId, userId: targetUserId })
      } else {
        await User.updateOne({ _id: targetUserId }, { status: 'banned', bannedUntil: expiresAt })
        await Member.deleteMany({ userId: targetUserId })
      }
      break

    case 'kick':
      if (roomId) {
        await Member.deleteOne({ roomId, userId: targetUserId })
      }
      break

    case 'shadow_ban':
      // Shadow ban: user sees their own messages but others don't
      // Handled at message distribution layer, no model change needed
      break

    case 'warn':
      // Warning is just logged — no model side effect
      break

    case 'message_removed':
      // Handled by caller with specific messageId
      break
  }

  await logAction({
    actionType: `moderation.${type}`,
    actorId: moderatorId,
    targetId: targetUserId,
    targetType: 'user',
    roomId,
    reason,
    metadata: { duration, expiresAt },
  })

  return { action }
}

export async function isUserMuted(userId: string, roomId: string): Promise<boolean> {
  const member = await Member.findOne({ roomId, userId })
  if (!member) return false
  if (member.roomRole !== 'muted') return false
  if (member.mutedUntil && member.mutedUntil < new Date()) {
    // Mute expired, restore to member
    await Member.updateOne({ roomId, userId }, { roomRole: 'member', mutedUntil: undefined })
    return false
  }
  return true
}

export async function isUserBanned(userId: string, roomId?: string): Promise<boolean> {
  // Check global ban
  const user = await User.findById(userId)
  if (!user || user.status === 'banned') {
    if (user?.bannedUntil && user.bannedUntil < new Date()) {
      await User.updateOne({ _id: userId }, { status: 'active', bannedUntil: undefined })
      return false
    }
    return user?.status === 'banned'
  }

  // Check room ban
  if (roomId) {
    const ban = await ModerationAction.findOne({
      targetUserId: userId,
      roomId,
      type: 'ban',
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

export async function isShadowBanned(userId: string, roomId?: string): Promise<boolean> {
  const query: Record<string, unknown> = {
    targetUserId: userId,
    type: 'shadow_ban',
    active: true,
  }
  if (roomId) query.roomId = roomId
  else query.roomId = { $exists: false }

  const sb = await ModerationAction.findOne(query)
  if (sb?.expiresAt && sb.expiresAt < new Date()) {
    await ModerationAction.updateOne({ _id: sb._id }, { active: false })
    return false
  }
  return !!sb
}

export async function deleteMessage(messageId: string, moderatorId: string, reason: string) {
  const msg = await Message.findById(messageId)
  if (!msg) return { error: 'الرسالة غير موجودة' }

  await Message.updateOne({ _id: messageId }, { status: 'deleted' })

  await logAction({
    actionType: 'moderation.message_removed',
    actorId: moderatorId,
    targetId: messageId,
    targetType: 'message',
    roomId: msg.roomId.toString(),
    reason,
  })

  return { success: true, roomId: msg.roomId.toString() }
}
