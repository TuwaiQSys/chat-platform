import { Router, type Request, type Response, type NextFunction } from 'express'
import { verifyToken } from './auth.service.js'
import { User } from './user.model.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOAD_DIR = path.join(__dirname, '../../../uploads/avatars')

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const router = Router()

// Auth middleware
async function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization?.replace('Bearer ', '')
  if (!auth) return res.status(401).json({ error: 'غير مصرح' })
  const payload = verifyToken(auth)
  if (!payload) return res.status(401).json({ error: 'جلسة منتهية' })
  ;(req as any).userId = payload.userId
  next()
}

// Upload avatar as base64
router.post('/upload', authenticate, async (req, res) => {
  try {
    const userId = (req as any).userId
    const { imageData } = req.body // base64 string

    if (!imageData) return res.status(400).json({ error: 'لا توجد صورة' })

    // Extract base64 data
    const matches = imageData.match(/^data:image\/(png|jpg|jpeg|gif|webp);base64,(.+)$/)
    if (!matches) return res.status(400).json({ error: 'صيغة الصورة غير صالحة' })

    const ext = matches[1]
    const data = matches[2]
    const filename = `${userId}.${ext}`
    const filepath = path.join(UPLOAD_DIR, filename)

    fs.writeFileSync(filepath, Buffer.from(data, 'base64'))

    const avatarUrl = `/uploads/avatars/${filename}?t=${Date.now()}`
    await User.updateOne({ _id: userId }, { avatarUrl })

    res.json({ avatarUrl })
  } catch (err) {
    console.error('Avatar upload error:', err)
    res.status(500).json({ error: 'خطأ في رفع الصورة' })
  }
})

// Get default avatars list
router.get('/defaults', (_req, res) => {
  // Return a list of default avatar colors/options
  res.json({
    defaults: [
      '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
      '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e',
      '#14b8a6', '#06b6d4', '#3b82f6',
    ],
  })
})

export default router
