import mongoose, { Schema, type Document } from 'mongoose'

export interface IUser extends Document {
  nickname: string
  type: 'guest' | 'member' | 'admin'
  email?: string
  passwordHash?: string
  avatarColor: string
  systemRole: 'user' | 'moderator' | 'admin'
  status: 'active' | 'suspended' | 'banned'
  bannedUntil?: Date
  membershipPlan?: string
  membershipExpiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    nickname: { type: String, required: true, trim: true, minlength: 2, maxlength: 20 },
    type: { type: String, enum: ['guest', 'member', 'admin'], default: 'guest' },
    email: { type: String, sparse: true, unique: true, lowercase: true, trim: true },
    passwordHash: String,
    avatarColor: { type: String, required: true },
    systemRole: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
    status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
    bannedUntil: Date,
    membershipPlan: { type: String, default: null },
    membershipExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
)

UserSchema.index({ nickname: 1 })
UserSchema.index({ email: 1 })
UserSchema.index({ status: 1 })
UserSchema.index({ type: 1 })

export const User = mongoose.model<IUser>('User', UserSchema)
