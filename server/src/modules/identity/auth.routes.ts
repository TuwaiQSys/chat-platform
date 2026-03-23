import { Router } from 'express'
import { registerMember, login, verifyToken } from './auth.service.js'
import { User } from './user.model.js'
import { MembershipPlan } from './membership-plan.model.js'
import { getUserPermissions, getUserRoleDisplay } from '../roles/role.service.js'

const router = Router()

// Register new member
router.post('/register', async (req, res) => {
  const result = await registerMember(req.body)
  if (result.error) return res.status(400).json({ error: result.error })

  const perms = await getUserPermissions(result.user!._id.toString())
  const display = await getUserRoleDisplay(result.user!._id.toString())

  res.json({
    user: {
      id: result.user!._id,
      nickname: result.user!.nickname,
      email: result.user!.email,
      avatar: result.user!.avatarColor,
      type: result.user!.type,
      permissions: perms,
      roleColor: display.color,
      roleBadge: display.badge,
      visibility: display.visibility,
    },
    token: result.token,
  })
})

// Login by email or username
router.post('/login', async (req, res) => {
  // Support both { email, password } and { username, password } and { identifier, password }
  const identifier = req.body.identifier || req.body.email || req.body.username
  const result = await login({ identifier, password: req.body.password })
  if (result.error) return res.status(400).json({ error: result.error })

  const perms = await getUserPermissions(result.user!._id.toString())
  const display = await getUserRoleDisplay(result.user!._id.toString())
  const hasAdmin = perms.some((p) => p.startsWith('admin.'))

  res.json({
    user: {
      id: result.user!._id,
      nickname: result.user!.nickname,
      email: result.user!.email,
      username: result.user!.username,
      avatar: result.user!.avatarColor,
      type: result.user!.type,
      permissions: perms,
      roleColor: display.color,
      roleBadge: display.badge,
      roleName: display.roleName,
      visibility: display.visibility,
      isAdmin: hasAdmin,
    },
    token: result.token,
  })
})

// Get current user from token
router.get('/me', async (req, res) => {
  const auth = req.headers.authorization?.replace('Bearer ', '')
  if (!auth) return res.status(401).json({ error: 'غير مصرح' })

  const payload = verifyToken(auth)
  if (!payload) return res.status(401).json({ error: 'جلسة منتهية' })

  const user = await User.findById(payload.userId).select('-passwordHash').populate('roles', 'name nameAr color badge priority')
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  const perms = await getUserPermissions(user._id.toString())
  const display = await getUserRoleDisplay(user._id.toString())

  res.json({
    user: {
      id: user._id,
      nickname: user.nickname,
      email: user.email,
      username: user.username,
      avatar: user.avatarColor,
      type: user.type,
      roles: user.roles,
      permissions: perms,
      roleColor: display.color,
      roleBadge: display.badge,
      visibility: user.visibility,
      statusText: user.statusText,
      membershipPlan: user.membershipPlan,
    },
  })
})

// Get membership plans (public)
router.get('/plans', async (_req, res) => {
  const plans = await MembershipPlan.find({ active: true }).sort({ sortOrder: 1 })
  res.json({ plans })
})

export default router
