import { Router } from 'express'
import { registerMember, loginMember, verifyToken } from './auth.service.js'
import { User } from './user.model.js'
import { MembershipPlan } from './membership-plan.model.js'

const router = Router()

// Register new member
router.post('/register', async (req, res) => {
  const result = await registerMember(req.body)
  if (result.error) return res.status(400).json({ error: result.error })
  res.json({
    user: {
      id: result.user!._id,
      nickname: result.user!.nickname,
      email: result.user!.email,
      avatar: result.user!.avatarColor,
      type: result.user!.type,
      systemRole: result.user!.systemRole,
      membershipPlan: result.user!.membershipPlan,
    },
    token: result.token,
  })
})

// Login member or admin
router.post('/login', async (req, res) => {
  const result = await loginMember(req.body)
  if (result.error) return res.status(400).json({ error: result.error })
  res.json({
    user: {
      id: result.user!._id,
      nickname: result.user!.nickname,
      email: result.user!.email,
      avatar: result.user!.avatarColor,
      type: result.user!.type,
      systemRole: result.user!.systemRole,
      membershipPlan: result.user!.membershipPlan,
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

  const user = await User.findById(payload.userId).select('-passwordHash')
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  res.json({
    user: {
      id: user._id,
      nickname: user.nickname,
      email: user.email,
      avatar: user.avatarColor,
      type: user.type,
      systemRole: user.systemRole,
      membershipPlan: user.membershipPlan,
      membershipExpiresAt: user.membershipExpiresAt,
    },
  })
})

// Get membership plans
router.get('/plans', async (_req, res) => {
  const plans = await MembershipPlan.find({ active: true }).sort({ sortOrder: 1 })
  res.json({ plans })
})

export default router
