import mongoose, { Schema, type Document } from 'mongoose'

// Permissions that can be toggled per plan or per user
export interface IPermissions {
  canChat: boolean
  canUploadAvatar: boolean
  canUploadMedia: boolean
  canCreateRooms: boolean
  maxRoomsOwned: number
  canChangeNicknameColor: boolean
  canSeeOnlineList: boolean
  canSendPrivateMessages: boolean
  maxMessageLength: number
  badge?: string
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
    canChat: { type: Boolean, default: true },
    canUploadAvatar: { type: Boolean, default: false },
    canUploadMedia: { type: Boolean, default: false },
    canCreateRooms: { type: Boolean, default: false },
    maxRoomsOwned: { type: Number, default: 0 },
    canChangeNicknameColor: { type: Boolean, default: false },
    canSeeOnlineList: { type: Boolean, default: true },
    canSendPrivateMessages: { type: Boolean, default: false },
    maxMessageLength: { type: Number, default: 500 },
    badge: String,
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
        canChat: true,
        canUploadAvatar: false,
        canUploadMedia: false,
        canCreateRooms: false,
        maxRoomsOwned: 0,
        canChangeNicknameColor: false,
        canSeeOnlineList: true,
        canSendPrivateMessages: false,
        maxMessageLength: 300,
      },
    },
    {
      name: 'premium',
      nameAr: 'مميز',
      price: 29,
      durationDays: 30,
      sortOrder: 1,
      permissions: {
        canChat: true,
        canUploadAvatar: true,
        canUploadMedia: true,
        canCreateRooms: true,
        maxRoomsOwned: 3,
        canChangeNicknameColor: true,
        canSeeOnlineList: true,
        canSendPrivateMessages: true,
        maxMessageLength: 1000,
        badge: '⭐',
      },
    },
    {
      name: 'vip',
      nameAr: 'VIP',
      price: 79,
      durationDays: 30,
      sortOrder: 2,
      permissions: {
        canChat: true,
        canUploadAvatar: true,
        canUploadMedia: true,
        canCreateRooms: true,
        maxRoomsOwned: 10,
        canChangeNicknameColor: true,
        canSeeOnlineList: true,
        canSendPrivateMessages: true,
        maxMessageLength: 2000,
        badge: '👑',
      },
    },
  ]

  await MembershipPlan.insertMany(plans)
  console.log(`Seeded ${plans.length} membership plans`)
}
