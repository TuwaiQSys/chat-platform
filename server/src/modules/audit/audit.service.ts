import mongoose from 'mongoose'
import { AuditLog } from './audit-log.model.js'

export async function logAction(params: {
  actionType: string
  actorId: string | mongoose.Types.ObjectId
  targetId?: string
  targetType?: string
  roomId?: string | mongoose.Types.ObjectId
  reason?: string
  metadata?: Record<string, unknown>
}) {
  try {
    await AuditLog.create({
      actionType: params.actionType,
      actorId: params.actorId,
      targetId: params.targetId,
      targetType: params.targetType,
      roomId: params.roomId || undefined,
      reason: params.reason,
      metadata: params.metadata,
    })
  } catch (err) {
    console.error('Audit log failed:', err)
  }
}
