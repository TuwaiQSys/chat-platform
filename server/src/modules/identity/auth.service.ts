import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { User, type IUser } from './user.model.js'
import { Role } from '../roles/role.model.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const SALT_ROUNDS = 10

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6']

export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string }
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

  if (!nickname || nickname.length < 2 || nickname.length > 20) return { error: 'الاسم يجب أن يكون بين 2 و 20 حرف' }
  if (!email || !email.includes('@')) return { error: 'البريد الإلكتروني غير صالح' }
  if (!password || password.length < 6) return { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }

  const existing = await User.findOne({ email: email.toLowerCase() })
  if (existing) return { error: 'البريد الإلكتروني مسجل مسبقًا' }

  const memberRole = await Role.findOne({ name: 'member' })
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  const user = await User.create({
    nickname,
    type: 'member',
    email: email.toLowerCase(),
    passwordHash,
    avatarColor: getAvatarColor(nickname),
    roles: memberRole ? [memberRole._id] : [],
    statusText: 'عضو جديد',
    membershipPlan: 'free',
  })

  const token = generateToken(user._id.toString())
  return { user, token }
}

// Login by email OR username
export async function login(data: {
  identifier: string  // email or username
  password: string
}): Promise<{ user?: IUser; token?: string; error?: string }> {
  const { identifier, password } = data
  if (!identifier || !password) return { error: 'بيانات الدخول مطلوبة' }

  const query = identifier.includes('@')
    ? { email: identifier.toLowerCase() }
    : { username: identifier.toLowerCase() }

  const user = await User.findOne({ ...query, type: { $in: ['member', 'staff'] } }).populate('roles')
  if (!user || !user.passwordHash) return { error: 'بيانات الدخول غير صحيحة' }
  if (user.status === 'banned') return { error: 'هذا الحساب محظور' }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return { error: 'بيانات الدخول غير صحيحة' }

  const token = generateToken(user._id.toString())
  return { user, token }
}

// Admin creates staff accounts from the control panel
export async function createStaff(data: {
  username: string
  nickname: string
  password: string
  roleNames: string[]
  createdBy: string
}): Promise<{ user?: IUser; error?: string }> {
  const { username, nickname, password, roleNames, createdBy } = data

  if (!username || username.length < 3) return { error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }
  if (!nickname || nickname.length < 2) return { error: 'الاسم المستعار مطلوب' }
  if (!password || password.length < 6) return { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }
  if (!roleNames.length) return { error: 'يجب اختيار دور واحد على الأقل' }

  const existingUsername = await User.findOne({ username: username.toLowerCase() })
  if (existingUsername) return { error: 'اسم المستخدم مسجل مسبقًا' }

  const roles = await Role.find({ name: { $in: roleNames } })
  if (roles.length !== roleNames.length) return { error: 'بعض الأدوار غير موجودة' }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  const user = await User.create({
    username: username.toLowerCase(),
    nickname,
    type: 'staff',
    passwordHash,
    avatarColor: getAvatarColor(nickname),
    roles: roles.map((r) => r._id),
    statusText: 'طاقم',
    createdBy,
  })

  return { user }
}

// Seed the super_admin on first run
export async function seedSuperAdmin() {
  const staffCount = await User.countDocuments({ type: 'staff' })
  if (staffCount > 0) return

  const superAdminRole = await Role.findOne({ name: 'super_admin' })
  if (!superAdminRole) return

  const passwordHash = await bcrypt.hash('admin123', SALT_ROUNDS)

  await User.create({
    username: 'admin',
    nickname: 'المسؤول',
    type: 'staff',
    passwordHash,
    avatarColor: getAvatarColor('المسؤول'),
    roles: [superAdminRole._id],
    statusText: 'المسؤول الأعلى',
  })

  console.log('Seeded super admin: username=admin / password=admin123')
}
