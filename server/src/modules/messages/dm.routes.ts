import { Router, type Request, type Response, type NextFunction } from 'express'
import { verifyToken } from '../identity/auth.service.js'
import { User } from '../identity/user.model.js'
import { DMThread, DMMessage, getOrCreateThread } from './dm.model.js'
import mongoose from 'mongoose'

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

router.use(authenticate)

// Get my DM threads with unread counts
router.get('/threads', async (req, res) => {
  const userId = (req as any).userId

  const threads = await DMThread.find({ participants: userId })
    .sort({ lastMessageAt: -1 })
    .populate('participants', 'nickname avatarColor type')
    .lean()

  // Get unread counts per thread
  const threadIds = threads.map(t => t._id)
  const unreadCounts = await DMMessage.aggregate([
    { $match: { threadId: { $in: threadIds }, senderId: { $ne: new mongoose.Types.ObjectId(userId) }, read: false } },
    { $group: { _id: '$threadId', count: { $sum: 1 } } },
  ])
  const unreadMap = new Map(unreadCounts.map(u => [u._id.toString(), u.count]))

  // Total unread
  const totalUnread = unreadCounts.reduce((sum, u) => sum + u.count, 0)

  const result = threads.map(t => {
    const other = (t.participants as any[]).find((p: any) => p._id.toString() !== userId)
    return {
      id: t._id.toString(),
      otherUser: other ? { id: other._id.toString(), nickname: other.nickname, avatar: other.avatarColor, type: other.type } : null,
      lastMessage: t.lastMessage,
      lastMessageAt: t.lastMessageAt,
      unread: unreadMap.get(t._id.toString()) || 0,
    }
  })

  res.json({ threads: result, totalUnread })
})

// Get messages for a thread
router.get('/threads/:threadId/messages', async (req, res) => {
  const userId = (req as any).userId
  const { threadId } = req.params

  // Verify user is participant
  const thread = await DMThread.findOne({ _id: threadId, participants: userId })
  if (!thread) return res.status(404).json({ error: 'المحادثة غير موجودة' })

  const messages = await DMMessage.find({ threadId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('senderId', 'nickname avatarColor')
    .lean()

  // Mark messages as read
  await DMMessage.updateMany(
    { threadId, senderId: { $ne: userId }, read: false },
    { read: true },
  )

  res.json({
    messages: messages.reverse().map(m => ({
      id: m._id.toString(),
      senderId: (m.senderId as any)?._id?.toString(),
      senderName: (m.senderId as any)?.nickname,
      senderAvatar: (m.senderId as any)?.avatarColor,
      content: m.content,
      read: m.read,
      createdAt: m.createdAt,
    })),
  })
})

// Get or create thread with a user + send first message optionally
router.post('/threads', async (req, res) => {
  const userId = (req as any).userId
  const { targetUserId } = req.body

  if (!targetUserId || targetUserId === userId) return res.status(400).json({ error: 'هدف غير صالح' })

  const thread = await getOrCreateThread(userId, targetUserId)
  res.json({ threadId: thread._id.toString() })
})

// Get total unread count (for the tab badge)
router.get('/unread', async (req, res) => {
  const userId = (req as any).userId

  const threads = await DMThread.find({ participants: userId }).select('_id')
  const threadIds = threads.map(t => t._id)

  const unread = await DMMessage.countDocuments({
    threadId: { $in: threadIds },
    senderId: { $ne: userId },
    read: false,
  })

  // Count unique senders
  const uniqueSenders = await DMMessage.distinct('senderId', {
    threadId: { $in: threadIds },
    senderId: { $ne: userId },
    read: false,
  })

  res.json({ unreadMessages: unread, unreadUsers: uniqueSenders.length })
})

export default router
