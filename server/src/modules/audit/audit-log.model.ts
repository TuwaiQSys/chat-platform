import mongoose, { Schema, type Document } from 'mongoose'

export interface IAuditLog extends Document {
  actionType: string
  actorId: mongoose.Types.ObjectId
  targetId?: string
  targetType?: string
  roomId?: mongoose.Types.ObjectId
  reason?: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actionType: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetId: String,
    targetType: String,
    roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
    reason: String,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

AuditLogSchema.index({ actionType: 1, createdAt: -1 })
AuditLogSchema.index({ actorId: 1, createdAt: -1 })
AuditLogSchema.index({ targetId: 1 })

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema)
