import { Router, type Request, type Response, type NextFunction } from 'express'
import { verifyToken } from '../identity/auth.service.js'
import { User } from '../identity/user.model.js'
import { hasPermission } from '../roles/role.service.js'
import { getAntiAbuseConfig, updateAntiAbuseConfig } from './anti-abuse-config.model.js'

const router = Router()

// Auth + permission check
async function requireAntiAbuseAdmin(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization?.replace('Bearer ', '')
  if (!auth) return res.status(401).json({ error: 'غير مصرح' })

  const payload = verifyToken(auth)
  if (!payload) return res.status(401).json({ error: 'جلسة منتهية' })

  const user = await User.findById(payload.userId)
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' })

  const allowed = await hasPermission(user._id.toString(), 'admin.configure_antiabuse')
  if (!allowed) return res.status(403).json({ error: 'صلاحيات غير كافية' })

  ;(req as any).user = user
  next()
}

router.use(requireAntiAbuseAdmin)

router.get('/', async (_req, res) => {
  const config = await getAntiAbuseConfig()
  res.json({ config })
})

router.patch('/', async (req, res) => {
  const allowed = [
    'globalFloodLimit', 'globalFloodWindowSeconds', 'globalSlowModeSeconds',
    'duplicateMessageWindow', 'maxMessageLength', 'spamScoreThreshold',
    'autoMuteOnSpam', 'autoMuteDuration',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  const config = await updateAntiAbuseConfig(updates as any)
  res.json({ config })
})

export default router
