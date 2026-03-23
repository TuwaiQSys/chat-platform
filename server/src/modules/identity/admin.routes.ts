import { Router, type Request, type Response, type NextFunction } from 'express'
import { verifyToken } from './auth.service.js'
import { User } from './user.model.js'
import { Room } from '../rooms/room.model.js'
import { Message } from '../messages/message.model.js'
import { Member } from '../rooms/member.model.js'
import { ModerationAction } from '../moderation/moderation-action.model.js'
import { AuditLog } from '../audit/audit-log.model.js'
import { MembershipPlan } from './membership-plan.model.js'

const router = Router()

// Admin auth middleware
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization?.replace('Bearer ', '')
  if (!auth) return res.status(401).json({ error: 'غير مصرح' })

  const payload = verifyToken(auth)
  if (!payload) return res.status(401).json({ error: 'جلسة منتهية' })

  const user = await User.findById(payload.userId)
  if (!user || user.systemRole !== 'admin') {
    return res.status(403).json({ error: 'صلاحيات غير كافية' })
  }

  ;(req as any).adminUser = user
  next()
}

router.use(requireAdmin)

// --- Dashboard Stats ---
router.get('/stats', async (_req, res) => {
  const [totalUsers, guests, members, admins, totalRooms, totalMessages, activeActions, pendingReports] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ type: 'guest' }),
    User.countDocuments({ type: 'member' }),
    User.countDocuments({ type: 'admin' }),
    Room.countDocuments({ status: 'active' }),
    Message.countDocuments(),
    ModerationAction.countDocuments({ active: true }),
    ModerationAction.countDocuments({ type: { $in: ['ban', 'mute'] }, active: true }),
  ])

  res.json({
    users: { total: totalUsers, guests, members, admins },
    rooms: totalRooms,
    messages: totalMessages,
    moderation: { activeActions, pendingReports },
  })
})

// --- Users Management ---
router.get('/users', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const type = req.query.type as string
  const search = req.query.search as string

  const filter: Record<string, unknown> = {}
  if (type && ['guest', 'member', 'admin'].includes(type)) filter.type = type
  if (search) filter.nickname = { $regex: search, $options: 'i' }

  const [users, total] = await Promise.all([
    User.find(filter).select('-passwordHash').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments(filter),
  ])

  res.json({ users, total, page, pages: Math.ceil(total / limit) })
})

router.patch('/users/:id/role', async (req, res) => {
  const { systemRole } = req.body
  if (!['user', 'moderator', 'admin'].includes(systemRole)) {
    return res.status(400).json({ error: 'دور غير صالح' })
  }

  const user = await User.findByIdAndUpdate(req.params.id, { systemRole }, { new: true }).select('-passwordHash')
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  res.json({ user })
})

router.patch('/users/:id/status', async (req, res) => {
  const { status } = req.body
  if (!['active', 'suspended', 'banned'].includes(status)) {
    return res.status(400).json({ error: 'حالة غير صالحة' })
  }

  const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true }).select('-passwordHash')
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  res.json({ user })
})

router.patch('/users/:id/membership', async (req, res) => {
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

// --- Rooms Management ---
router.get('/rooms', async (_req, res) => {
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

router.post('/rooms', async (req, res) => {
  const { name, description, type, maxMembers } = req.body
  const admin = (req as any).adminUser

  const room = await Room.create({
    name,
    description: description || '',
    type: type || 'text',
    createdBy: admin._id,
    config: { maxMembers: maxMembers || 40, slowModeSeconds: 0, allowMediaUpload: false, maxMessageLength: 500, linkPolicy: 'allow', wordBlocklist: [] },
  })

  res.json({ room })
})

router.patch('/rooms/:id', async (req, res) => {
  const updates: Record<string, unknown> = {}
  if (req.body.name) updates.name = req.body.name
  if (req.body.description !== undefined) updates.description = req.body.description
  if (req.body.status) updates.status = req.body.status
  if (req.body.featured !== undefined) updates.featured = req.body.featured
  if (req.body.config) updates.config = req.body.config

  const room = await Room.findByIdAndUpdate(req.params.id, updates, { new: true })
  if (!room) return res.status(404).json({ error: 'الغرفة غير موجودة' })

  res.json({ room })
})

// --- Moderation ---
router.get('/moderation/actions', async (req, res) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const active = req.query.active === 'true'

  const filter: Record<string, unknown> = {}
  if (req.query.active) filter.active = active

  const [actions, total] = await Promise.all([
    ModerationAction.find(filter)
      .populate('targetUserId', 'nickname avatarColor')
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

router.patch('/moderation/actions/:id/revoke', async (req, res) => {
  const action = await ModerationAction.findByIdAndUpdate(req.params.id, { active: false }, { new: true })
  if (!action) return res.status(404).json({ error: 'الإجراء غير موجود' })

  // If it was a ban, unban the user
  if (action.type === 'ban' && !action.roomId) {
    await User.updateOne({ _id: action.targetUserId }, { status: 'active', bannedUntil: null })
  }

  // If it was a mute, unmute
  if (action.type === 'mute' && action.roomId) {
    await Member.updateOne(
      { roomId: action.roomId, userId: action.targetUserId },
      { roomRole: 'member', mutedUntil: null },
    )
  }

  res.json({ action })
})

// --- Audit Logs ---
router.get('/audit', async (req, res) => {
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

// --- Membership Plans ---
router.get('/plans', async (_req, res) => {
  const plans = await MembershipPlan.find().sort({ sortOrder: 1 })
  res.json({ plans })
})

router.post('/plans', async (req, res) => {
  const plan = await MembershipPlan.create(req.body)
  res.json({ plan })
})

router.patch('/plans/:id', async (req, res) => {
  const plan = await MembershipPlan.findByIdAndUpdate(req.params.id, req.body, { new: true })
  if (!plan) return res.status(404).json({ error: 'الباقة غير موجودة' })
  res.json({ plan })
})

export default router
