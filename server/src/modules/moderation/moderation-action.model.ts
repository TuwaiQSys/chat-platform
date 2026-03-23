import mongoose, { Schema, type Document } from 'mongoose'

export const MODERATION_ACTION_TYPES = [
  'kick.room', 'kick.global',
  'mute.text.room', 'mute.text.global',
  'mute.voice.room', 'mute.voice.global',
  'mute.both.room', 'mute.both.global',
  'ban.room', 'ban.global',
  'ban.ip', 'ban.fingerprint', 'ban.layered',
  'message.delete', 'warn',
] as const

export type ModerationActionType = typeof MODERATION_ACTION_TYPES[number]

// Map action type → required permission key
export const ACTION_PERMISSION_MAP: Record<ModerationActionType, string> = {
  'kick.room': 'mod.kick.room',
  'kick.global': 'mod.kick.global',
  'mute.text.room': 'mod.mute.text.room',
  'mute.text.global': 'mod.mute.text.global',
  'mute.voice.room': 'mod.mute.voice.room',
  'mute.voice.global': 'mod.mute.voice.global',
  'mute.both.room': 'mod.mute.both.room',
  'mute.both.global': 'mod.mute.both.room', // both.room covers both in room
  'ban.room': 'mod.ban.room',
  'ban.global': 'mod.ban.global',
  'ban.ip': 'mod.ban.ip',
  'ban.fingerprint': 'mod.ban.fingerprint',
  'ban.layered': 'mod.ban.layered',
  'message.delete': 'mod.delete_message',
  'warn': 'mod.kick.room', // warn requires at least room kick permission
}

// Arabic labels for UI
export const ACTION_LABELS_AR: Record<ModerationActionType, string> = {
  'kick.room': 'طرد من الغرفة',
  'kick.global': 'طرد من الشات',
  'mute.text.room': 'كتم النص (غرفة)',
  'mute.text.global': 'كتم النص (شامل)',
  'mute.voice.room': 'كتم الصوت (غرفة)',
  'mute.voice.global': 'كتم الصوت (شامل)',
  'mute.both.room': 'كتم كامل (غرفة)',
  'mute.both.global': 'كتم كامل (شامل)',
  'ban.room': 'حظر من الغرفة',
  'ban.global': 'حظر شامل',
  'ban.ip': 'حظر IP',
  'ban.fingerprint': 'حظر بصمة الجهاز',
  'ban.layered': 'حظر متعدد الطبقات',
  'message.delete': 'حذف رسالة',
  'warn': 'تحذير',
}

export interface IModerationAction extends Document {
  type: ModerationActionType
  targetUserId: mongoose.Types.ObjectId
  roomId?: mongoose.Types.ObjectId
  moderatorId: mongoose.Types.ObjectId
  reason: string
  duration?: number             // minutes, null = permanent
  expiresAt?: Date
  active: boolean
  ipAddress?: string            // for IP bans
  fingerprintHash?: string      // for fingerprint bans
  metadata?: Record<string, unknown>  // layered ban signals, extra data
  createdAt: Date
}

const ModerationActionSchema = new Schema<IModerationAction>(
  {
    type: { type: String, enum: MODERATION_ACTION_TYPES, required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: Schema.Types.ObjectId, ref: 'Room' },
    moderatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, maxlength: 500 },
    duration: Number,
    expiresAt: Date,
    active: { type: Boolean, default: true },
    ipAddress: String,
    fingerprintHash: String,
    metadata: Schema.Types.Mixed,
  },
  { timestamps: true },
)

ModerationActionSchema.index({ targetUserId: 1, type: 1, active: 1 })
ModerationActionSchema.index({ roomId: 1, type: 1, active: 1 })
ModerationActionSchema.index({ ipAddress: 1, active: 1 })
ModerationActionSchema.index({ fingerprintHash: 1, active: 1 })
ModerationActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const ModerationAction = mongoose.model<IModerationAction>('ModerationAction', ModerationActionSchema)
