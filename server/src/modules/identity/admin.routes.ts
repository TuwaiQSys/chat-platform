import { Router, type Request, type Response, type NextFunction } from 'express'
import { verifyToken } from './auth.service.js'
import { User } from './user.model.js'
import { Room } from '../rooms/room.model.js'
import { Message } from '../messages/message.model.js'
import { Member } from '../rooms/member.model.js'
import { ModerationAction } from '../moderation/moderation-action.model.js'
import { AuditLog } from '../audit/audit-log.model.js'
import { MembershipPlan } from './membership-plan.model.js'
import { Role } from '../roles/role.model.js'
import { hasPermission, invalidateCache } from '../roles/role.service.js'
import { PERMISSIONS, PERMISSION_CATEGORIES } from '../roles/permissions.js'
import { createStaff } from './auth.service.js'

const router = Router()

// --- Auth middleware: verify token and load user ---
async function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization?.replace('Bearer ', '')
  if (!auth) return res.status(401).json({ error: 'غير مصرح' })

  const payload = verifyToken(auth)
  if (!payload) return res.status(401).json({ error: 'جلسة منتهية' })

  const user = await User.findById(payload.userId).populate('roles')
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  ;(req as any).user = user
  next()
}

// --- Permission middleware factory ---
function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user
    if (!user) return res.status(401).json({ error: 'غير مصرح' })

    const allowed = await hasPermission(user._id.toString(), permission)
    if (!allowed) return res.status(403).json({ error: 'صلاحيات غير كافية' })

    next()
  }
}

router.use(authenticate)

// ===================== DASHBOARD =====================

router.get('/stats', requirePermission('admin.manage_users'), async (_req, res) => {
  const [totalUsers, guests, members, staff, totalRooms, totalMessages, activeActions] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ type: 'guest' }),
    User.countDocuments({ type: 'member' }),
    User.countDocuments({ type: 'staff' }),
    Room.countDocuments({ status: 'active' }),
    Message.countDocuments(),
    ModerationAction.countDocuments({ active: true }),
  ])

  res.json({
    users: { total: totalUsers, guests, members, staff },
    rooms: totalRooms,
    messages: totalMessages,
    moderation: { activeActions },
  })
})

// ===================== USERS =====================

router.get('/users', requirePermission('admin.manage_users'), async (req, res) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const type = req.query.type as string
  const search = req.query.search as string

  const filter: Record<string, unknown> = {}
  if (type && ['guest', 'member', 'staff'].includes(type)) filter.type = type
  if (search) filter.nickname = { $regex: search, $options: 'i' }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-passwordHash')
      .populate('roles', 'name nameAr color badge priority')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    User.countDocuments(filter),
  ])

  // Include lastIp for admin visibility
  res.json({ users, total, page, pages: Math.ceil(total / limit) })
})

router.patch('/users/:id/status', requirePermission('admin.manage_users'), async (req, res) => {
  const { status } = req.body
  if (!['active', 'suspended', 'banned'].includes(status)) return res.status(400).json({ error: 'حالة غير صالحة' })

  const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('-passwordHash')
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  res.json({ user })
})

router.patch('/users/:id/roles', requirePermission('admin.manage_roles'), async (req, res) => {
  const { roleIds } = req.body
  if (!Array.isArray(roleIds)) return res.status(400).json({ error: 'الأدوار مطلوبة' })

  const user = await User.findByIdAndUpdate(req.params.id, { roles: roleIds }, { new: true })
    .select('-passwordHash')
    .populate('roles', 'name nameAr color badge priority')
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  invalidateCache(req.params.id)
  res.json({ user })
})

router.patch('/users/:id/visibility', requirePermission('admin.manage_users'), async (req, res) => {
  const { visibility } = req.body
  if (!['visible', 'hidden', 'royal_hidden'].includes(visibility)) return res.status(400).json({ error: 'قيمة غير صالحة' })

  const user = await User.findByIdAndUpdate(req.params.id, { visibility }, { new: true }).select('-passwordHash')
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  res.json({ user })
})

router.patch('/users/:id/membership', requirePermission('admin.manage_plans'), async (req, res) => {
  const { planName, durationDays } = req.body
  const plan = await MembershipPlan.findOne({ name: planName })
  if (!plan && planName !== 'free') return res.status(400).json({ error: 'الباقة غير موجودة' })

  const expiresAt = planName === 'free' ? null : new Date(Date.now() + (durationDays || plan?.durationDays || 30) * 86400000)

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { membershipPlan: planName, membershipExpiresAt: expiresAt },
    { new: true },
  ).select('-passwordHash')
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  res.json({ user })
})

// ===================== STAFF =====================

router.post('/staff', requirePermission('admin.create_staff'), async (req, res) => {
  const adminUser = (req as any).user
  const result = await createStaff({
    ...req.body,
    createdBy: adminUser._id.toString(),
  })
  if (result.error) return res.status(400).json({ error: result.error })

  const user = await User.findById(result.user!._id)
    .select('-passwordHash')
    .populate('roles', 'name nameAr color badge priority')

  res.json({ user })
})

// ===================== ROLES =====================

router.get('/roles', requirePermission('admin.manage_roles'), async (_req, res) => {
  const roles = await Role.find().sort({ priority: -1 })
  res.json({ roles })
})

router.post('/roles', requirePermission('admin.manage_roles'), async (req, res) => {
  try {
    const role = await Role.create({ ...req.body, isSystem: false })
    res.json({ role })
  } catch (err: any) {
    if (err.code === 11000) return res.status(400).json({ error: 'اسم الدور مستخدم بالفعل' })
    res.status(400).json({ error: 'خطأ في إنشاء الدور' })
  }
})

router.patch('/roles/:id', requirePermission('admin.manage_roles'), async (req, res) => {
  const role = await Role.findById(req.params.id)
  if (!role) return res.status(404).json({ error: 'الدور غير موجود' })

  // Don't allow changing isSystem
  delete req.body.isSystem
  Object.assign(role, req.body)
  await role.save()

  invalidateCache('') // invalidate all since role permissions changed
  res.json({ role })
})

router.delete('/roles/:id', requirePermission('admin.manage_roles'), async (req, res) => {
  const role = await Role.findById(req.params.id)
  if (!role) return res.status(404).json({ error: 'الدور غير موجود' })
  if (role.isSystem) return res.status(400).json({ error: 'لا يمكن حذف دور النظام' })

  // Remove role from all users who have it
  await User.updateMany({ roles: role._id }, { $pull: { roles: role._id } })
  await role.deleteOne()

  res.json({ success: true })
})

// ===================== PERMISSIONS =====================

router.get('/permissions', requirePermission('admin.manage_roles'), async (_req, res) => {
  res.json({ permissions: PERMISSIONS, categories: PERMISSION_CATEGORIES })
})

// ===================== ROOMS =====================

router.get('/rooms', requirePermission('admin.manage_users'), async (_req, res) => {
  const rooms = await Room.find().sort({ createdAt: -1 }).lean()
  const roomIds = rooms.map((r) => r._id)
  const memberCounts = await Member.aggregate([
    { $match: { roomId: { $in: roomIds } } },
    { $group: { _id: '$roomId', count: { $sum: 1 } } },
  ])
  const countMap = new Map(memberCounts.map((c) => [c._id.toString(), c.count]))

  res.json({
    rooms: rooms.map((r) => ({
      ...r,
      id: r._id,
      memberCount: countMap.get(r._id.toString()) || 0,
    })),
  })
})

router.post('/rooms', requirePermission('room.create'), async (req, res) => {
  const { name, description, type, config } = req.body
  const admin = (req as any).user

  const room = await Room.create({
    name,
    description: description || '',
    type: type || 'text',
    createdBy: admin._id,
    config: {
      maxMembers: config?.maxMembers || 40,
      slowModeSeconds: config?.slowModeSeconds || 0,
      allowMediaUpload: config?.allowMediaUpload || false,
      maxMessageLength: config?.maxMessageLength || 500,
      linkPolicy: config?.linkPolicy || 'allow',
      wordBlocklist: config?.wordBlocklist || [],
      access: config?.access || 'public',
      tags: config?.tags || [],
      floodLimit: config?.floodLimit || 10,
      floodWindowSeconds: config?.floodWindowSeconds || 10,
      duplicateProtection: config?.duplicateProtection || false,
    },
  })

  res.json({ room })
})

router.patch('/rooms/:id', requirePermission('room.edit'), async (req, res) => {
  const updates: Record<string, unknown> = {}
  const allowed = ['name', 'description', 'status', 'featured', 'coverImage', 'config', 'tags']
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  const room = await Room.findByIdAndUpdate(req.params.id, updates, { new: true })
  if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة' })

  res.json({ room })
})

// ===================== MODERATION =====================

router.get('/moderation/actions', requirePermission('admin.manage_users'), async (req, res) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const active = req.query.active === 'true'

  const filter: Record<string, unknown> = {}
  if (req.query.active) filter.active = active

  const [actions, total] = await Promise.all([
    ModerationAction.find(filter)
      .populate('targetUserId', 'nickname avatarColor lastIp')
      .populate('moderatorId', 'nickname')
      .populate('roomId', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ModerationAction.countDocuments(filter),
  ])

  res.json({ actions, total, page, pages: Math.ceil(total / limit) })
})

router.patch('/moderation/actions/:id/revoke', requirePermission('admin.manage_users'), async (req, res) => {
  const action = await ModerationAction.findByIdAndUpdate(req.params.id, { active: false }, { new: true })
  if (!action) return res.status(404).json({ error: 'الإجراء غير موجود' })

  // Unban if it was a global/ip/fingerprint/layered ban
  if (['ban.global', 'ban.ip', 'ban.fingerprint', 'ban.layered'].includes(action.type)) {
    await User.updateOne({ _id: action.targetUserId }, { status: 'active', bannedUntil: null })
  }

  // Unmute if room mute
  if (action.type.startsWith('mute.') && action.roomId) {
    await Member.updateOne(
      { roomId: action.roomId, userId: action.targetUserId },
      { roomRole: 'member', mutedUntil: null },
    )
  }

  res.json({ action })
})

// ===================== AUDIT =====================

router.get('/audit', requirePermission('admin.view_audit'), async (req, res) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 30

  const [logs, total] = await Promise.all([
    AuditLog.find()
      .populate('actorId', 'nickname')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(),
  ])

  res.json({ logs, total, page, pages: Math.ceil(total / limit) })
})

// ===================== MEMBERSHIP PLANS =====================

router.get('/plans', requirePermission('admin.manage_plans'), async (_req, res) => {
  const plans = await MembershipPlan.find().sort({ sortOrder: 1 })
  res.json({ plans })
})

router.post('/plans', requirePermission('admin.manage_plans'), async (req, res) => {
  const plan = await MembershipPlan.create(req.body)
  res.json({ plan })
})

router.patch('/plans/:id', requirePermission('admin.manage_plans'), async (req, res) => {
  const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!plan) return res.status(404).json({ error: 'الباقة غير موجودة' })
  res.json({ plan })
})

export default router
