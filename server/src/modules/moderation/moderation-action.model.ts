import mongoose, { Schema, type Document } from 'mongoose'

export type ModerationActionType = 'mute' | 'ban' | 'warn' | 'shadow_ban' | 'kick' | 'message_removed'

export interface IModerationAction extends Document {
  type: ModerationActionType
  targetUserId: mongoose.Types.ObjectId
  roomId?: mongoose.Types.ObjectId
  moderatorId: mongoose.Types.ObjectId
  reason: string
  expiresAt?: Date
  active: boolean
  createdAt: Date
}

const ModerationActionSchema = new Schema<IModerationAction>(
  {
    type: {
      type: String,
      enum: ['mute', 'ban', 'warn', 'shadow_ban', 'kick', 'message_removed'],
      required: true,
    },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
    moderatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, maxlength: 500 },
    expiresAt: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

ModerationActionSchema.index({ targetUserId: 1, type: 1, active: 1 })
ModerationActionSchema.index({ roomId: 1, type: 1, active: 1 })
ModerationActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const ModerationAction = mongoose.model<IModerationAction>('ModerationAction', ModerationActionSchema)
