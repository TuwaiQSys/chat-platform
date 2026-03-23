import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import crypto from 'crypto'

import { connectDB, dbConnected } from './config/db.js'
import { User } from './modules/identity/user.model.js'
import { Session } from './modules/identity/session.model.js'
import { Room } from './modules/rooms/room.model.js'
import { Member } from './modules/rooms/member.model.js'
import { Message } from './modules/messages/message.model.js'
import { seedRooms } from './modules/rooms/seed.js'
import { executeModAction, isUserMuted, isUserBanned, isShadowBanned, deleteMessage, canModerate } from './modules/moderation/moderation.service.js'
import { recordFingerprint, type ClientSignals } from './modules/anti-abuse/fingerprint.service.js'
import { seedAdmin, getAvatarColor, verifyToken } from './modules/identity/auth.service.js'
import { MembershipPlan, seedPlans } from './modules/identity/membership-plan.model.js'
import authRoutes from './modules/identity/auth.routes.js'
import adminRoutes from './modules/identity/admin.routes.js'
import { logAction } from './modules/audit/audit.service.js'
import { checkRateLimit } from './middleware/rate-limiter.js'

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

app.use(cors())
app.use(express.json())

// --- Routes ---
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminRoutes)

// --- In-memory socket → user mapping ---
interface SocketUser {
  id: string
  nickname: string
  avatar: string
  currentRoom: string | null
  nicknameColor: string | null
  badge: string | null
  entryEffect: string | null
  hasBubbleStyle: boolean
  type: string
  systemRole: string
}
const socketToUser = new Map<string, SocketUser>()

// --- Plan cache (avoids repeated DB lookups) ---
interface PlanPerks {
  nicknameColor: string | null
  badge: string | null
  entryEffect: string | null
  hasBubbleStyle: boolean
}
const planCache = new Map<string, PlanPerks>()

async function getPlanPerks(planName?: string | null): Promise<PlanPerks> {
  if (!planName || planName === 'free') return { nicknameColor: null, badge: null, entryEffect: null, hasBubbleStyle: false }

  if (planCache.has(planName)) return planCache.get(planName)!

  const plan = await MembershipPlan.findOne({ name: planName })
  const perks: PlanPerks = {
    nicknameColor: plan?.permissions?.nicknameColor || null,
    badge: plan?.permissions?.badge || null,
    entryEffect: plan?.permissions?.entryEffect || null,
    hasBubbleStyle: plan?.permissions?.hasBubbleStyle ?? false,
  }
  planCache.set(planName, perks)
  return perks
}

// --- Helper: get online count ---
function getOnlineCount(): number {
  return socketToUser.size
}

// --- Helper: get room member list ---
async function getRoomMembersForClient(roomId: string) {
  const members = await Member.find({ roomId }).populate('userId', 'nickname avatarColor systemRole membershipPlan type')
  const result = []
  for (const m of members) {
    if (!m.userId) continue
    const u = m.userId as any
    const perks = await getPlanPerks(u.membershipPlan)
    result.push({
      id: u._id.toString(),
      nickname: u.nickname,
      avatar: u.avatarColor,
      systemRole: u.systemRole,
      roomRole: m.roomRole,
      type: u.type,
      nicknameColor: perks.nicknameColor,
      badge: perks.badge,
    })
  }
  return result
}

// --- Helper: get room list for client ---
async function getRoomListForClient() {
  const rooms = await Room.find({ status: 'active' })
  const roomIds = rooms.map((r) => r._id)
  const memberCounts = await Member.aggregate([
    { $match: { roomId: { $in: roomIds } } },
    { $group: { _id: '$roomId', count: { $sum: 1 } } },
  ])
  const countMap = new Map(memberCounts.map((c) => [c._id.toString(), c.count]))

  return rooms.map((r) => ({
    id: r._id.toString(),
    name: r.name,
    description: r.description,
    type: r.type,
    maxMembers: r.config.maxMembers,
    memberCount: countMap.get(r._id.toString()) || 0,
    featured: r.featured,
    coverImage: r.coverImage || null,
  }))
}

// --- Helper: create system message ---
async function createSystemMessage(roomId: string, content: string) {
  const msg = await Message.create({
    roomId,
    senderId: 'system',
    senderName: 'النظام',
    senderAvatar: '',
    type: 'system',
    content,
    status: 'visible',
  })
  return {
    id: msg._id.toString(),
    roomId: roomId.toString(),
    senderId: 'system',
    senderName: 'النظام',
    senderAvatar: '',
    type: 'system' as const,
    content,
    createdAt: msg.createdAt.getTime(),
  }
}

// --- REST API ---

app.get('/api/health', async (_req, res) => {
  const userCount = await User.countDocuments()
  const roomCount = await Room.countDocuments()
  res.json({ status: 'ok', users: userCount, online: getOnlineCount(), rooms: roomCount })
})

app.get('/api/rooms', async (_req, res) => {
  const rooms = await getRoomListForClient()
  res.json({ rooms, totalOnline: getOnlineCount() })
})

// --- Socket.IO ---

io.on('connection', (socket) => {
  let currentUserId: string | null = null

  socket.on('guest:join', async (data: { nickname: string; signals?: ClientSignals }, callback) => {
    try {
      const nickname = data.nickname?.trim()
      if (!nickname || nickname.length < 2 || nickname.length > 20) {
        return callback?.({ error: 'الاسم يجب أن يكون بين 2 و 20 حرف' })
      }

      // Check duplicate nickname among online users
      for (const u of socketToUser.values()) {
        if (u.nickname === nickname) {
          return callback?.({ error: 'هذا الاسم مستخدم بالفعل' })
        }
      }

      const avatarColor = getAvatarColor(nickname)

      // Create user in MongoDB
      const user = await User.create({
        nickname,
        type: 'guest',
        avatarColor,
        systemRole: 'user',
        status: 'active',
      })

      // Create session
      const token = crypto.randomBytes(24).toString('hex')
      const ip = (socket.handshake.headers['x-forwarded-for'] as string || socket.handshake.address || '').split(',')[0].trim()
      const userAgent = socket.handshake.headers['user-agent'] || ''

      await Session.create({
        userId: user._id,
        socketId: socket.id,
        token,
        ipAddress: ip,
        userAgent,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      // Record fingerprint
      if (data.signals) {
        await recordFingerprint(user._id.toString(), ip, userAgent, data.signals)
      }

      currentUserId = user._id.toString()
      socketToUser.set(socket.id, { id: currentUserId, nickname, avatar: avatarColor, currentRoom: null, nicknameColor: null, badge: null, entryEffect: null, hasBubbleStyle: false, type: 'guest', systemRole: 'user' })

      await logAction({ actionType: 'user.join', actorId: user._id, metadata: { type: 'guest', ip } })

      callback?.({ user: { id: currentUserId, nickname, avatar: avatarColor, type: 'guest', nicknameColor: null, badge: null } })
      io.emit('users:count', getOnlineCount())
    } catch (err) {
      console.error('guest:join error:', err)
      callback?.({ error: 'حدث خطأ' })
    }
  })

  // Authenticated join (member/admin with JWT token)
  socket.on('auth:join', async (data: { token: string }, callback) => {
    try {
      const payload = verifyToken(data.token)
      if (!payload) return callback?.({ error: 'جلسة منتهية' })

      const user = await User.findById(payload.userId)
      if (!user || user.status !== 'active') return callback?.({ error: 'الحساب غير متاح' })

      // Check duplicate
      for (const u of socketToUser.values()) {
        if (u.id === user._id.toString()) return callback?.({ error: 'أنت متصل بالفعل' })
      }

      const ip = (socket.handshake.headers['x-forwarded-for'] as string || socket.handshake.address || '').split(',')[0].trim()

      await Session.create({
        userId: user._id,
        socketId: socket.id,
        token: data.token,
        ipAddress: ip,
        userAgent: socket.handshake.headers['user-agent'] || '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })

      currentUserId = user._id.toString()
      const perks = await getPlanPerks(user.membershipPlan)
      socketToUser.set(socket.id, { id: currentUserId, nickname: user.nickname, avatar: user.avatarColor, currentRoom: null, nicknameColor: perks.nicknameColor, badge: perks.badge, entryEffect: perks.entryEffect, hasBubbleStyle: perks.hasBubbleStyle, type: user.type, systemRole: user.systemRole })

      callback?.({
        user: {
          id: currentUserId,
          nickname: user.nickname,
          avatar: user.avatarColor,
          type: user.type,
          systemRole: user.systemRole,
          membershipPlan: user.membershipPlan,
          nicknameColor: perks.nicknameColor,
          badge: perks.badge,
        },
      })
      io.emit('users:count', getOnlineCount())
    } catch (err) {
      console.error('auth:join error:', err)
      callback?.({ error: 'حدث خطأ' })
    }
  })

  socket.on('room:join', async (data: { roomId: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير مسجل الدخول' })

      const room = await Room.findById(data.roomId)
      if (!room || room.status !== 'active') return callback?.({ error: 'الغرفة غير موجودة' })

      // Check if banned from this room
      if (await isUserBanned(currentUserId, data.roomId)) {
        return callback?.({ error: 'أنت محظور من هذه الغرفة' })
      }

      const memberCount = await Member.countDocuments({ roomId: data.roomId })
      if (memberCount >= room.config.maxMembers) return callback?.({ error: 'الغرفة ممتلئة' })

      const socketUser = socketToUser.get(socket.id)

      // Leave current room
      if (socketUser?.currentRoom) {
        await Member.deleteOne({ roomId: socketUser.currentRoom, userId: currentUserId })
        socket.leave(socketUser.currentRoom)

        const leaveMsg = await createSystemMessage(socketUser.currentRoom, `${socketUser.nickname} غادر الغرفة`)
        io.to(socketUser.currentRoom).emit('message:new', leaveMsg)
        io.to(socketUser.currentRoom).emit('room:members', await getRoomMembersForClient(socketUser.currentRoom))
      }

      // Join new room
      await Member.findOneAndUpdate(
        { roomId: data.roomId, userId: currentUserId },
        { roomRole: 'member', joinedAt: new Date() },
        { upsert: true, new: true },
      )

      if (socketUser) socketUser.currentRoom = data.roomId
      socket.join(data.roomId)

      const badge = socketUser?.badge ? ` ${socketUser.badge}` : ''
      const joinMsg = await createSystemMessage(data.roomId, `${socketUser?.nickname}${badge} انضم إلى الغرفة`)
      io.to(data.roomId).emit('message:new', joinMsg)

      // Emit entry effect for premium users
      if (socketUser?.entryEffect) {
        io.to(data.roomId).emit('user:entry-effect', {
          userId: currentUserId,
          nickname: socketUser.nickname,
          effect: socketUser.entryEffect,
          badge: socketUser.badge,
        })
      }

      const members = await getRoomMembersForClient(data.roomId)
      io.to(data.roomId).emit('room:members', members)

      // Send last 50 messages
      const recentMessages = await Message.find({ roomId: data.roomId, status: { $in: ['visible', 'flagged'] } })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()

      const messagesForClient = recentMessages.reverse().map((m) => ({
        id: m._id.toString(),
        roomId: m.roomId.toString(),
        senderId: m.senderId?.toString() || 'system',
        senderName: m.senderName,
        senderAvatar: m.senderAvatar,
        type: m.type,
        content: m.content,
        createdAt: m.createdAt.getTime(),
      }))

      callback?.({
        room: { id: room._id.toString(), name: room.name, description: room.description, type: room.type },
        messages: messagesForClient,
        members,
      })

      io.emit('rooms:update', await getRoomListForClient())
    } catch (err) {
      console.error('room:join error:', err)
      callback?.({ error: 'حدث خطأ' })
    }
  })

  socket.on('message:send', async (data: { content: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير متصل' })

      const socketUser = socketToUser.get(socket.id)
      if (!socketUser?.currentRoom) return callback?.({ error: 'غير متصل بغرفة' })

      const content = data.content?.trim()
      if (!content || content.length > 500) return callback?.({ error: 'الرسالة غير صالحة' })

      // Rate limit check
      const rateCheck = checkRateLimit(currentUserId)
      if (!rateCheck.allowed) {
        return callback?.({ error: `أنت ترسل بسرعة كبيرة، انتظر ${rateCheck.retryAfter} ثواني` })
      }

      // Check if muted
      if (await isUserMuted(currentUserId, socketUser.currentRoom)) {
        return callback?.({ error: 'أنت في وضع الكتم' })
      }

      // Check if banned
      if (await isUserBanned(currentUserId)) {
        return callback?.({ error: 'حسابك محظور' })
      }

      // Store message
      const msg = await Message.create({
        roomId: socketUser.currentRoom,
        senderId: currentUserId,
        senderName: socketUser.nickname,
        senderAvatar: socketUser.avatar,
        type: 'text',
        content,
        status: 'visible',
      })

      const msgForClient = {
        id: msg._id.toString(),
        roomId: socketUser.currentRoom,
        senderId: currentUserId,
        senderName: socketUser.nickname,
        senderAvatar: socketUser.avatar,
        senderNicknameColor: socketUser.nicknameColor,
        senderBadge: socketUser.badge,
        senderHasBubbleStyle: socketUser.hasBubbleStyle,
        type: 'text' as const,
        content,
        createdAt: msg.createdAt.getTime(),
      }

      // Shadow ban check: only send to sender if shadow banned
      if (await isShadowBanned(currentUserId, socketUser.currentRoom)) {
        socket.emit('message:new', msgForClient)
      } else {
        io.to(socketUser.currentRoom).emit('message:new', msgForClient)
      }

      callback?.({ id: msg._id.toString() })
    } catch (err) {
      console.error('message:send error:', err)
      callback?.({ error: 'حدث خطأ' })
    }
  })

  // --- Moderation Events ---

  socket.on('mod:action', async (data: {
    action: 'mute' | 'ban' | 'kick' | 'shadow_ban' | 'warn'
    targetUserId: string
    roomId?: string
    reason: string
    duration?: number
  }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير متصل' })

      const result = await executeModAction({
        type: data.action,
        targetUserId: data.targetUserId,
        moderatorId: currentUserId,
        roomId: data.roomId,
        reason: data.reason || 'مخالفة',
        duration: data.duration,
      })

      if (result.error) return callback?.({ error: result.error })

      const socketUser = socketToUser.get(socket.id)
      const targetSocketEntry = [...socketToUser.entries()].find(([, u]) => u.id === data.targetUserId)

      // Handle kick — force target out of room
      if (data.action === 'kick' && data.roomId && targetSocketEntry) {
        const [targetSocketId, targetUser] = targetSocketEntry
        const targetSocket = io.sockets.sockets.get(targetSocketId)
        if (targetSocket) {
          targetSocket.leave(data.roomId)
          targetSocket.emit('room:kicked', { roomId: data.roomId, reason: data.reason })
          if (targetUser) targetUser.currentRoom = null
        }

        const kickMsg = await createSystemMessage(data.roomId, `${targetUser.nickname} تم طرده من الغرفة`)
        io.to(data.roomId).emit('message:new', kickMsg)
        io.to(data.roomId).emit('room:members', await getRoomMembersForClient(data.roomId))
      }

      // Handle ban — force target out
      if (data.action === 'ban') {
        if (data.roomId && targetSocketEntry) {
          const [targetSocketId, targetUser] = targetSocketEntry
          const targetSocket = io.sockets.sockets.get(targetSocketId)
          if (targetSocket) {
            targetSocket.leave(data.roomId)
            targetSocket.emit('room:banned', { roomId: data.roomId, reason: data.reason, global: false })
            if (targetUser) targetUser.currentRoom = null
          }

          const banMsg = await createSystemMessage(data.roomId, `${targetUser.nickname} تم حظره`)
          io.to(data.roomId).emit('message:new', banMsg)
          io.to(data.roomId).emit('room:members', await getRoomMembersForClient(data.roomId))
        } else if (!data.roomId && targetSocketEntry) {
          // Global ban — disconnect
          const [targetSocketId] = targetSocketEntry
          const targetSocket = io.sockets.sockets.get(targetSocketId)
          if (targetSocket) {
            targetSocket.emit('user:banned', { reason: data.reason })
            targetSocket.disconnect(true)
          }
        }
      }

      // Handle mute notification
      if (data.action === 'mute' && data.roomId && targetSocketEntry) {
        const [targetSocketId] = targetSocketEntry
        const targetSocket = io.sockets.sockets.get(targetSocketId)
        targetSocket?.emit('room:muted', { roomId: data.roomId, reason: data.reason, duration: data.duration })

        const muteMsg = await createSystemMessage(data.roomId, `${targetSocketEntry[1].nickname} تم كتمه`)
        io.to(data.roomId).emit('message:new', muteMsg)
      }

      io.emit('rooms:update', await getRoomListForClient())
      callback?.({ success: true })
    } catch (err) {
      console.error('mod:action error:', err)
      callback?.({ error: 'حدث خطأ' })
    }
  })

  socket.on('mod:delete-message', async (data: { messageId: string; reason: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير متصل' })

      const result = await deleteMessage(data.messageId, currentUserId, data.reason || 'محتوى مخالف')
      if (result.error) return callback?.({ error: result.error })

      io.to(result.roomId!).emit('message:deleted', { messageId: data.messageId })
      callback?.({ success: true })
    } catch (err) {
      console.error('mod:delete-message error:', err)
      callback?.({ error: 'حدث خطأ' })
    }
  })

  socket.on('mod:check-permissions', async (data: { targetUserId: string; roomId?: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ actions: [] })

      const moderator = await User.findById(currentUserId)
      if (!moderator) return callback?.({ actions: [] })

      const actions: string[] = []
      for (const action of ['mute', 'kick', 'ban', 'warn', 'shadow_ban'] as const) {
        const check = await canModerate(currentUserId, data.targetUserId, action, data.roomId)
        if (check.allowed) actions.push(action)
      }

      callback?.({ actions })
    } catch (err) {
      callback?.({ actions: [] })
    }
  })

  // --- Typing ---

  // --- Broadcast (admin only) ---
  socket.on('broadcast:send', async (data: { content: string; roomId?: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير متصل' })
      const user = await User.findById(currentUserId)
      if (!user || user.systemRole !== 'admin') return callback?.({ error: 'صلاحيات غير كافية' })

      if (data.roomId) {
        const msg = await createSystemMessage(data.roomId, `📢 ${data.content}`)
        io.to(data.roomId).emit('message:new', msg)
      } else {
        // Global broadcast to all connected sockets
        io.emit('broadcast:global', { content: data.content, from: user.nickname, createdAt: Date.now() })
      }
      await logAction({ actionType: 'broadcast.send', actorId: currentUserId, roomId: data.roomId, metadata: { content: data.content } })
      callback?.({ success: true })
    } catch (err) {
      callback?.({ error: 'حدث خطأ' })
    }
  })

  // --- Private Messages (DM) ---
  socket.on('dm:send', async (data: { targetUserId: string; content: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير متصل' })
      const content = data.content?.trim()
      if (!content || content.length > 500) return callback?.({ error: 'الرسالة غير صالحة' })

      // Check if sender has DM permission
      const sender = await User.findById(currentUserId)
      if (sender?.membershipPlan && sender.membershipPlan !== 'free') {
        // Allowed
      } else if (sender?.systemRole === 'admin' || sender?.systemRole === 'moderator') {
        // Allowed
      } else {
        // Check plan
        const plan = sender?.membershipPlan ? await MembershipPlan.findOne({ name: sender.membershipPlan }) : null
        if (!plan?.permissions?.canSendPrivateMessages) {
          return callback?.({ error: 'الرسائل الخاصة تتطلب عضوية مميزة' })
        }
      }

      const socketUser = socketToUser.get(socket.id)
      const targetSocketEntry = [...socketToUser.entries()].find(([, u]) => u.id === data.targetUserId)

      if (!targetSocketEntry) return callback?.({ error: 'المستخدم غير متصل' })

      const dmPayload = {
        id: crypto.randomBytes(12).toString('hex'),
        senderId: currentUserId,
        senderName: socketUser?.nickname || '',
        senderAvatar: socketUser?.avatar || '',
        senderNicknameColor: socketUser?.nicknameColor || null,
        senderBadge: socketUser?.badge || null,
        content,
        createdAt: Date.now(),
      }

      const [targetSocketId] = targetSocketEntry
      const targetSocket = io.sockets.sockets.get(targetSocketId)
      targetSocket?.emit('dm:receive', dmPayload)
      socket.emit('dm:sent', { ...dmPayload, targetUserId: data.targetUserId })

      callback?.({ success: true })
    } catch (err) {
      callback?.({ error: 'حدث خطأ' })
    }
  })

  // --- Room Creation (permission-based) ---
  socket.on('room:create', async (data: { name: string; description?: string; type?: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير متصل' })

      const user = await User.findById(currentUserId)
      if (!user) return callback?.({ error: 'المستخدم غير موجود' })

      // Check permission
      if (user.systemRole !== 'admin') {
        const plan = user.membershipPlan ? await MembershipPlan.findOne({ name: user.membershipPlan }) : null
        if (!plan?.permissions?.canCreateRooms) {
          return callback?.({ error: 'إنشاء الغرف يتطلب عضوية مميزة' })
        }
        // Check max rooms owned
        const ownedRooms = await Room.countDocuments({ createdBy: currentUserId, status: 'active' })
        if (plan.permissions.maxRoomsOwned && ownedRooms >= plan.permissions.maxRoomsOwned) {
          return callback?.({ error: `وصلت للحد الأقصى (${plan.permissions.maxRoomsOwned} غرف)` })
        }
      }

      const name = data.name?.trim()
      if (!name || name.length < 2 || name.length > 30) return callback?.({ error: 'اسم الغرفة غير صالح' })

      const room = await Room.create({
        name,
        description: data.description?.trim() || '',
        type: data.type || 'text',
        createdBy: currentUserId,
        config: { maxMembers: 30, slowModeSeconds: 0, allowMediaUpload: false, maxMessageLength: 500, linkPolicy: 'allow', wordBlocklist: [] },
      })

      await logAction({ actionType: 'room.create', actorId: currentUserId, targetId: room._id.toString(), targetType: 'room' })

      io.emit('rooms:update', await getRoomListForClient())
      callback?.({ room: { id: room._id.toString(), name: room.name } })
    } catch (err) {
      callback?.({ error: 'حدث خطأ' })
    }
  })

  socket.on('typing:start', () => {
    const socketUser = socketToUser.get(socket.id)
    if (socketUser?.currentRoom) {
      socket.to(socketUser.currentRoom).emit('typing:update', {
        userId: socketUser.id,
        nickname: socketUser.nickname,
        typing: true,
      })
    }
  })

  socket.on('typing:stop', () => {
    const socketUser = socketToUser.get(socket.id)
    if (socketUser?.currentRoom) {
      socket.to(socketUser.currentRoom).emit('typing:update', {
        userId: socketUser.id,
        nickname: socketUser.nickname,
        typing: false,
      })
    }
  })

  // --- Disconnect ---

  socket.on('disconnect', async () => {
    try {
      const socketUser = socketToUser.get(socket.id)
      if (!socketUser) return

      if (socketUser.currentRoom) {
        await Member.deleteOne({ roomId: socketUser.currentRoom, userId: socketUser.id })
        const leaveMsg = await createSystemMessage(socketUser.currentRoom, `${socketUser.nickname} غادر الغرفة`)
        io.to(socketUser.currentRoom).emit('message:new', leaveMsg)
        io.to(socketUser.currentRoom).emit('room:members', await getRoomMembersForClient(socketUser.currentRoom))
      }

      // Clean up session
      await Session.deleteMany({ socketId: socket.id })

      // Mark guest users as inactive (don't delete — audit trail)
      const user = await User.findById(socketUser.id)
      if (user?.type === 'guest') {
        // Guest users are ephemeral but we keep them for audit
      }

      socketToUser.delete(socket.id)
      io.emit('users:count', getOnlineCount())
      io.emit('rooms:update', await getRoomListForClient())
    } catch (err) {
      console.error('disconnect error:', err)
      socketToUser.delete(socket.id)
    }
  })
})

// --- Startup ---

const PORT = parseInt(process.env.PORT || '3001')

async function start() {
  await connectDB()
  await seedRooms()
  await seedAdmin()
  await seedPlans()

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

start().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})
