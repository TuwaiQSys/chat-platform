import mongoose, { Schema, type Document } from 'mongoose'

// Permissions that can be toggled per plan or per user
// All functional features (chat, message length) are the same for everyone.
// Plans only control cosmetic/visual perks and elevated privileges.
export interface IPermissions {
  canUploadAvatar: boolean
  canUploadMedia: boolean
  canCreateRooms: boolean
  maxRoomsOwned: number
  nicknameColor: string | null  // null = default, hex color = custom
  canChangeNicknameColor: boolean
  canSendPrivateMessages: boolean
  badge?: string
  entryEffect?: string  // e.g. 'glow', 'sparkle' — visual effect on join
}

export interface IMembershipPlan extends Document {
  name: string
  nameAr: string
  price: number
  currency: string
  durationDays: number // 0 = lifetime
  permissions: IPermissions
  active: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

const PermissionsSchema = new Schema<IPermissions>(
  {
    canUploadAvatar: { type: Boolean, default: false },
    canUploadMedia: { type: Boolean, default: false },
    canCreateRooms: { type: Boolean, default: false },
    maxRoomsOwned: { type: Number, default: 0 },
    nicknameColor: { type: String, default: null },
    canChangeNicknameColor: { type: Boolean, default: false },
    canSendPrivateMessages: { type: Boolean, default: false },
    badge: String,
    entryEffect: String,
  },
  { _id: false },
)

const MembershipPlanSchema = new Schema<IMembershipPlan>(
  {
    name: { type: String, required: true, unique: true },
    nameAr: { type: String, required: true },
    price: { type: Number, required: true },
    currency: { type: String, default: 'SAR' },
    durationDays: { type: Number, required: true },
    permissions: { type: PermissionsSchema, default: () => ({}) },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export const MembershipPlan = mongoose.model<IMembershipPlan>('MembershipPlan', MembershipPlanSchema)

// Seed default plans
export async function seedPlans() {
  const count = await MembershipPlan.countDocuments()
  if (count > 0) return

  const plans = [
    {
      name: 'free',
      nameAr: 'مجاني',
      price: 0,
      durationDays: 0,
      sortOrder: 0,
      permissions: {
        canUploadAvatar: false,
        canUploadMedia: false,
        canCreateRooms: false,
        maxRoomsOwned: 0,
        nicknameColor: null,
        canChangeNicknameColor: false,
        canSendPrivateMessages: false,
      },
    },
    {
      name: 'premium',
      nameAr: 'مميز',
      price: 29,
      durationDays: 30,
      sortOrder: 1,
      permissions: {
        canUploadAvatar: true,
        canUploadMedia: true,
        canCreateRooms: true,
        maxRoomsOwned: 3,
        nicknameColor: '#f59e0b',
        canChangeNicknameColor: true,
        canSendPrivateMessages: true,
        badge: '⭐',
        entryEffect: 'glow',
      },
    },
    {
      name: 'vip',
      nameAr: 'VIP',
      price: 79,
      durationDays: 30,
      sortOrder: 2,
      permissions: {
        canUploadAvatar: true,
        canUploadMedia: true,
        canCreateRooms: true,
        maxRoomsOwned: 10,
        nicknameColor: '#a855f7',
        canChangeNicknameColor: true,
        canSendPrivateMessages: true,
        badge: '👑',
        entryEffect: 'sparkle',
      },
    },
  ]

  await MembershipPlan.insertMany(plans)
  console.log(`Seeded ${plans.length} membership plans`)
}
