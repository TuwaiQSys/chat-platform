import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { User, type IUser } from './user.model.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const SALT_ROUNDS = 10

// Avatar color generation
const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6']

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function generateToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; role: string }
  } catch {
    return null
  }
}

export async function registerMember(data: {
  nickname: string
  email: string
  password: string
}): Promise<{ user?: IUser; token?: string; error?: string }> {
  const { nickname, email, password } = data

  if (!nickname || nickname.length < 2 || nickname.length > 20) {
    return { error: 'الاسم يجب أن يكون بين 2 و 20 حرف' }
  }
  if (!email || !email.includes('@')) {
    return { error: 'البريد الإلكتروني غير صالح' }
  }
  if (!password || password.length < 6) {
    return { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
  }

  const existingEmail = await User.findOne({ email: email.toLowerCase() })
  if (existingEmail) return { error: 'البريد الإلكتروني مسجل مسبقًا' }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  const user = await User.create({
    nickname,
    type: 'member',
    email: email.toLowerCase(),
    passwordHash,
    avatarColor: getAvatarColor(nickname),
    systemRole: 'user',
    status: 'active',
    membershipPlan: 'free',
  })

  const token = generateToken(user._id.toString(), 'user')
  return { user, token }
}

export async function loginMember(data: {
  email: string
  password: string
}): Promise<{ user?: IUser; token?: string; error?: string }> {
  const { email, password } = data

  if (!email || !password) return { error: 'البريد وكلمة المرور مطلوبان' }

  const user = await User.findOne({ email: email.toLowerCase(), type: { $in: ['member', 'admin'] } })
  if (!user || !user.passwordHash) return { error: 'بيانات الدخول غير صحيحة' }

  if (user.status === 'banned') return { error: 'هذا الحساب محظور' }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return { error: 'بيانات الدخول غير صحيحة' }

  const token = generateToken(user._id.toString(), user.systemRole)
  return { user, token }
}

export async function createAdmin(data: {
  nickname: string
  email: string
  password: string
}): Promise<{ user?: IUser; error?: string }> {
  const { nickname, email, password } = data

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) return { error: 'البريد الإلكتروني مسجل مسبقًا' }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  const user = await User.create({
    nickname,
    type: 'admin',
    email: email.toLowerCase(),
    passwordHash,
    avatarColor: getAvatarColor(nickname),
    systemRole: 'admin',
    status: 'active',
  })

  return { user }
}

// Seed default admin if none exists
export async function seedAdmin() {
  const adminCount = await User.countDocuments({ type: 'admin' })
  if (adminCount > 0) return

  await createAdmin({
    nickname: 'المسؤول',
    email: 'admin@chat.com',
    password: 'admin123',
  })
  console.log('Seeded default admin: admin@chat.com / admin123')
}

export { getAvatarColor }
