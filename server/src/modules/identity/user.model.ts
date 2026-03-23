import mongoose, { Schema, type Document } from 'mongoose'

export interface IUser extends Document {
  nickname: string
  type: 'guest' | 'member' | 'staff'
  username?: string             // for staff login (null for guests)
  email?: string
  passwordHash?: string
  avatarColor: string
  avatarUrl?: string            // uploaded avatar
  roles: mongoose.Types.ObjectId[]
  visibility: 'visible' | 'hidden' | 'royal_hidden'
  status: 'active' | 'suspended' | 'banned'
  bannedUntil?: Date
  statusText: string            // custom status (عضو جديد, غير مسجل, etc.)
  countryCode?: string          // ISO 2-letter for flag display
  lastIp: string                // last known IP — visible to admins for IP bans
  lastUserAgent: string
  membershipPlan?: string
  membershipExpiresAt?: Date
  createdBy?: mongoose.Types.ObjectId  // who created this staff account
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    nickname: { type: String, required: true, trim: true, minlength: 2, maxlength: 20 },
    type: { type: String, enum: ['guest', 'member', 'staff'], default: 'guest' },
    username: { type: String, sparse: true, unique: true, trim: true, lowercase: true },
    email: { type: String, sparse: true, unique: true, lowercase: true, trim: true },
    passwordHash: String,
    avatarColor: { type: String, required: true },
    avatarUrl: String,
    roles: [{ type: Schema.Types.ObjectId, ref: 'Role' }],
    visibility: { type: String, enum: ['visible', 'hidden', 'royal_hidden'], default: 'visible' },
    status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active' },
    bannedUntil: Date,
    statusText: { type: String, default: '' },
    countryCode: { type: String, default: null },
    lastIp: { type: String, default: '' },
    lastUserAgent: { type: String, default: '' },
    membershipPlan: { type: String, default: null },
    membershipExpiresAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
)

UserSchema.index({ nickname: 1 })
UserSchema.index({ status: 1 })
UserSchema.index({ type: 1 })
UserSchema.index({ visibility: 1 })
UserSchema.index({ lastIp: 1 })
UserSchema.index({ roles: 1 })

export const User = mongoose.model<IUser>('User', UserSchema)
