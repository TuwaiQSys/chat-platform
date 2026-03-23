import mongoose, { Schema, type Document } from 'mongoose'

export interface IMember extends Document {
  roomId: mongoose.Types.ObjectId
  userId: mongoose.Types.ObjectId
  roomRole: 'owner' | 'moderator' | 'member' | 'muted'
  joinedAt: Date
  mutedUntil?: Date
}

const MemberSchema = new Schema<IMember>({
  roomId: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  roomRole: { type: String, enum: ['owner', 'moderator', 'member', 'muted'], default: 'member' },
  joinedAt: { type: Date, default: Date.now },
  mutedUntil: Date,
})

MemberSchema.index({ roomId: 1, userId: 1 }, { unique: true })
MemberSchema.index({ roomId: 1 })
MemberSchema.index({ userId: 1 })

export const Member = mongoose.model<IMember>('Member', MemberSchema)
