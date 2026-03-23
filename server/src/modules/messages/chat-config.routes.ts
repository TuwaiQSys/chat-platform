import { Router, type Request, type Response, type NextFunction } from 'express'
import { verifyToken } from '../identity/auth.service.js'
import { User } from '../identity/user.model.js'
import { hasPermission } from '../roles/role.service.js'
import { getChatConfig, updateChatConfig, invalidateChatConfigCache } from './chat-config.model.js'

const router = Router()

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization?.replace('Bearer ', '')
  if (!auth) return res.status(401).json({ error: 'غير مصرح' })
  const payload = verifyToken(auth)
  if (!payload) return res.status(401).json({ error: 'جلسة منتهية' })
  const user = await User.findById(payload.userId)
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })
  const allowed = await hasPermission(user._id.toString(), 'admin.manage_users')
  if (!allowed) return res.status(403).json({ error: 'صلاحيات غير كافية' })
  ;(req as any).user = user
  next()
}

router.use(requireAdmin)

// Get chat config
router.get('/', async (_req, res) => {
  const config = await getChatConfig()
  res.json({ config })
})

// Update message colors
router.patch('/colors', async (req, res) => {
  const config = await updateChatConfig({ messageColors: req.body })
  res.json({ config })
})

// Update shortcuts
router.patch('/shortcuts', async (req, res) => {
  const config = await updateChatConfig({ shortcuts: req.body.shortcuts })
  res.json({ config })
})

// Update word filter
router.patch('/word-filter', async (req, res) => {
  const config = await updateChatConfig({ wordFilter: req.body })
  res.json({ config })
})

// Update custom emoji
router.patch('/emoji', async (req, res) => {
  const config = await updateChatConfig({ customEmoji: req.body.emoji })
  res.json({ config })
})

export default router
