import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import crypto from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import { connectDB } from './config/db.js'
import { User } from './modules/identity/user.model.js'
import { Session } from './modules/identity/session.model.js'
import { Room } from './modules/rooms/room.model.js'
import { Member } from './modules/rooms/member.model.js'
import { Message } from './modules/messages/message.model.js'
import { Role } from './modules/roles/role.model.js'
import { seedRooms } from './modules/rooms/seed.js'
import { seedRoles } from './modules/roles/seed.js'
import { seedSuperAdmin, getAvatarColor, verifyToken } from './modules/identity/auth.service.js'
import { seedPlans } from './modules/identity/membership-plan.model.js'
import { executeModAction, isUserMuted, isUserBanned, isIpBanned, isFingerprintBanned, deleteMessage, getAvailableActions } from './modules/moderation/moderation.service.js'
import { getUserPermissions, getUserRoleDisplay, hasPermission, invalidateCache } from './modules/roles/role.service.js'
import { recordFingerprint, type ClientSignals } from './modules/anti-abuse/fingerprint.service.js'
import { logAction } from './modules/audit/audit.service.js'
import { checkRateLimit } from './middleware/rate-limiter.js'
import authRoutes from './modules/identity/auth.routes.js'
import adminRoutes from './modules/identity/admin.routes.js'

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
  permissions: string[]
  roleColor: string | null
  roleBadge: string | null
  visibility: string
  type: string
  lastIp: string
}
const socketToUser = new Map<string, SocketUser>()

function getOnlineCount(): number {
  return socketToUser.size
}

// --- Get online user list (filtered by viewer's visibility permissions) ---
function getOnlineUsersForViewer(viewerPermissions: string[]) {
  const canSeeHidden = viewerPermissions.includes('view.hidden_users')
  const canSeeRoyalHidden = viewerPermissions.includes('view.royal_hidden_users')

  const users: any[] = []
  for (const u of socketToUser.values()) {
    if (u.visibility === 'hidden' && !canSeeHidden) continue
    if (u.visibility === 'royal_hidden' && !canSeeRoyalHidden) continue
    users.push({
      id: u.id,
      nickname: u.nickname,
      avatar: u.avatar,
      roleColor: u.roleColor,
      roleBadge: u.roleBadge,
      visibility: u.visibility,
      type: u.type,
    })
  }
  return users
}

// --- Room member list (filtered by viewer's visibility) ---
async function getRoomMembersForClient(roomId: string, viewerPermissions: string[] = []) {
  const members = await Member.find({ roomId }).populate({
    path: 'userId',
    select: 'nickname avatarColor roles visibility statusText countryCode lastIp type',
    populate: { path: 'roles', select: 'name nameAr color badge priority' },
  })

  const canSeeHidden = viewerPermissions.includes('view.hidden_users')
  const canSeeRoyalHidden = viewerPermissions.includes('view.royal_hidden_users')
  const canSeeIp = viewerPermissions.includes('mod.ban.ip')

  const result = []
  for (const m of members) {
    if (!m.userId) continue
    const u = m.userId as any

    if (u.visibility === 'hidden' && !canSeeHidden) continue
    if (u.visibility === 'royal_hidden' && !canSeeRoyalHidden) continue

    // Get display from highest priority role
    let roleColor: string | null = null
    let roleBadge: string | null = null
    let bestPriority = -1
    for (const role of (u.roles || [])) {
      if (role.priority > bestPriority) {
        roleColor = role.color
        roleBadge = role.badge
        bestPriority = role.priority
      }
    }

    result.push({
      id: u._id.toString(),
      nickname: u.nickname,
      avatar: u.avatarColor,
      roleColor,
      roleBadge,
      roomRole: m.roomRole,
      visibility: u.visibility,
      statusText: u.statusText || '',
      countryCode: u.countryCode || null,
      type: u.type,
      lastIp: canSeeIp ? u.lastIp : undefined,
    })
  }
  return result
}

// --- Room list ---
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

// --- System message ---
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

  const getIp = () => {
    return (socket.handshake.headers['x-forwarded-for'] as string || socket.handshake.address || '').split(',')[0].trim()
  }

  // === GUEST JOIN ===
  socket.on('guest:join', async (data: { nickname: string; signals?: ClientSignals }, callback) => {
    try {
      const nickname = data.nickname?.trim()
      if (!nickname || nickname.length < 2 || nickname.length > 20) {
        return callback?.({ error: 'الاسم يجب أن يكون بين 2 و 20 حرف' })
      }

      for (const u of socketToUser.values()) {
        if (u.nickname === nickname) return callback?.({ error: 'هذا الاسم مستخدم بالفعل' })
      }

      const ip = getIp()

      // Check IP ban
      if (await isIpBanned(ip)) return callback?.({ error: 'أنت محظور' })

      const guestRole = await Role.findOne({ name: 'guest' })
      const avatarColor = getAvatarColor(nickname)

      const user = await User.create({
        nickname,
        type: 'guest',
        avatarColor,
        roles: guestRole ? [guestRole._id] : [],
        statusText: 'غير مسجل',
        lastIp: ip,
        lastUserAgent: socket.handshake.headers['user-agent'] || '',
      })

      await Session.create({
        userId: user._id,
        socketId: socket.id,
        token: crypto.randomBytes(24).toString('hex'),
        ipAddress: ip,
        userAgent: socket.handshake.headers['user-agent'] || '',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      // Record fingerprint
      let fpHash: string | undefined
      if (data.signals) {
        fpHash = await recordFingerprint(user._id.toString(), ip, socket.handshake.headers['user-agent'] || '', data.signals)
        if (fpHash && await isFingerprintBanned(fpHash)) {
          await User.deleteOne({ _id: user._id })
          return callback?.({ error: 'أنت محظور' })
        }
      }

      const permissions = await getUserPermissions(user._id.toString())

      currentUserId = user._id.toString()
      socketToUser.set(socket.id, {
        id: currentUserId, nickname, avatar: avatarColor, currentRoom: null,
        permissions, roleColor: null, roleBadge: null, visibility: 'visible',
        type: 'guest', lastIp: ip,
      })

      await logAction({ actionType: 'user.join', actorId: user._id, metadata: { type: 'guest', ip } })

      callback?.({
        user: { id: currentUserId, nickname, avatar: avatarColor, type: 'guest', permissions, roleColor: null, roleBadge: null },
      })
      io.emit('users:count', getOnlineCount())
    } catch (err) {
      console.error('guest:join error:', err)
      callback?.({ error: 'حدث خطأ' })
    }
  })

  // === AUTH JOIN (member/staff with JWT) ===
  socket.on('auth:join', async (data: { token: string }, callback) => {
    try {
      const payload = verifyToken(data.token)
      if (!payload) return callback?.({ error: 'جلسة منتهية' })

      const user = await User.findById(payload.userId).populate('roles')
      if (!user || user.status !== 'active') return callback?.({ error: 'الحساب غير متاح' })

      for (const u of socketToUser.values()) {
        if (u.id === user._id.toString()) return callback?.({ error: 'أنت متصل بالفعل' })
      }

      const ip = getIp()
      await User.updateOne({ _id: user._id }, { lastIp: ip, lastUserAgent: socket.handshake.headers['user-agent'] || '' })

      await Session.create({
        userId: user._id,
        socketId: socket.id,
        token: data.token,
        ipAddress: ip,
        userAgent: socket.handshake.headers['user-agent'] || '',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })

      const permissions = await getUserPermissions(user._id.toString())
      const display = await getUserRoleDisplay(user._id.toString())

      currentUserId = user._id.toString()
      socketToUser.set(socket.id, {
        id: currentUserId, nickname: user.nickname, avatar: user.avatarColor, currentRoom: null,
        permissions, roleColor: display.color, roleBadge: display.badge,
        visibility: display.visibility, type: user.type, lastIp: ip,
      })

      callback?.({
        user: {
          id: currentUserId, nickname: user.nickname, avatar: user.avatarColor,
          type: user.type, permissions, roleColor: display.color, roleBadge: display.badge,
          visibility: display.visibility, roleName: display.roleName,
        },
      })
      io.emit('users:count', getOnlineCount())
    } catch (err) {
      console.error('auth:join error:', err)
      callback?.({ error: 'حدث خطأ' })
    }
  })

  // === ONLINE USERS LIST ===
  socket.on('users:list', (_, callback) => {
    const socketUser = socketToUser.get(socket.id)
    const perms = socketUser?.permissions || []
    callback?.(getOnlineUsersForViewer(perms))
  })

  // === ROOM JOIN ===
  socket.on('room:join', async (data: { roomId: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير مسجل الدخول' })

      const room = await Room.findById(data.roomId)
      if (!room || room.status !== 'active') return callback?.({ error: 'الغرفة غير موجودة' })

      if (await isUserBanned(currentUserId, data.roomId)) return callback?.({ error: 'أنت محظور من هذه الغرفة' })

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

      const badge = socketUser?.roleBadge ? ` ${socketUser.roleBadge}` : ''
      const joinMsg = await createSystemMessage(data.roomId, `${socketUser?.nickname}${badge} انضم إلى الغرفة`)
      io.to(data.roomId).emit('message:new', joinMsg)

      const viewerPerms = socketUser?.permissions || []
      const members = await getRoomMembersForClient(data.roomId, viewerPerms)
      io.to(data.roomId).emit('room:members', members)

      const recentMessages = await Message.find({ roomId: data.roomId, status: { $in: ['visible', 'flagged'] } })
        .sort({ createdAt: -1 }).limit(50).lean()

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

  // === SEND MESSAGE ===
  socket.on('message:send', async (data: { content: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير متصل' })
      const socketUser = socketToUser.get(socket.id)
      if (!socketUser?.currentRoom) return callback?.({ error: 'غير متصل بغرفة' })

      const content = data.content?.trim()
      if (!content || content.length > 500) return callback?.({ error: 'الرسالة غير صالحة' })

      // Permission check
      const canSend = socketUser.permissions.includes('chat.send_text')
      if (!canSend) return callback?.({ error: 'لا تملك صلاحية الإرسال' })

      const rateCheck = checkRateLimit(currentUserId)
      if (!rateCheck.allowed) return callback?.({ error: `انتظر ${rateCheck.retryAfter} ثواني` })

      if (await isUserMuted(currentUserId, socketUser.currentRoom)) return callback?.({ error: 'أنت في وضع الكتم' })
      if (await isUserBanned(currentUserId)) return callback?.({ error: 'حسابك محظور' })

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
        senderRoleColor: socketUser.roleColor,
        senderRoleBadge: socketUser.roleBadge,
        type: 'text' as const,
        content,
        createdAt: msg.createdAt.getTime(),
      }

      io.to(socketUser.currentRoom).emit('message:new', msgForClient)
      callback?.({ id: msg._id.toString() })
    } catch (err) {
      console.error('message:send error:', err)
      callback?.({ error: 'حدث خطأ' })
    }
  })

  // === MODERATION ===
  socket.on('mod:action', async (data: {
    action: string
    targetUserId: string
    roomId?: string
    reason: string
    duration?: number
  }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير متصل' })

      const result = await executeModAction({
        type: data.action as any,
        targetUserId: data.targetUserId,
        moderatorId: currentUserId,
        roomId: data.roomId,
        reason: data.reason || 'مخالفة',
        duration: data.duration,
      })

      if (result.error) return callback?.({ error: result.error })

      const socketUser = socketToUser.get(socket.id)
      const targetEntry = [...socketToUser.entries()].find(([, u]) => u.id === data.targetUserId)

      // Force target out of room for kick/ban
      if (targetEntry) {
        const [targetSocketId, targetUser] = targetEntry
        const targetSocket = io.sockets.sockets.get(targetSocketId)

        if (data.action.startsWith('kick.') || data.action.startsWith('ban.')) {
          if (data.roomId && targetSocket) {
            targetSocket.leave(data.roomId)
            targetSocket.emit('room:kicked', { roomId: data.roomId, reason: data.reason })
            targetUser.currentRoom = null
          }
          if (data.action.includes('.global') || data.action === 'ban.ip' || data.action === 'ban.fingerprint' || data.action === 'ban.layered') {
            targetSocket?.emit('user:banned', { reason: data.reason })
            targetSocket?.disconnect(true)
          }

          if (data.roomId) {
            const msg = await createSystemMessage(data.roomId, `${targetUser.nickname} تم ${data.action.startsWith('kick') ? 'طرده' : 'حظره'}`)
            io.to(data.roomId).emit('message:new', msg)
            io.to(data.roomId).emit('room:members', await getRoomMembersForClient(data.roomId))
          }
        }

        if (data.action.startsWith('mute.') && data.roomId) {
          targetSocket?.emit('room:muted', { roomId: data.roomId, reason: data.reason, duration: data.duration })
          const msg = await createSystemMessage(data.roomId, `${targetUser.nickname} تم كتمه`)
          io.to(data.roomId).emit('message:new', msg)
        }
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
      callback?.({ error: 'حدث خطأ' })
    }
  })

  socket.on('mod:check-permissions', async (data: { targetUserId: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ actions: [] })
      const actions = await getAvailableActions(currentUserId, data.targetUserId)
      callback?.({ actions })
    } catch {
      callback?.({ actions: [] })
    }
  })

  // === BROADCAST ===
  socket.on('broadcast:send', async (data: { content: string; roomId?: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير متصل' })

      const permission = data.roomId ? 'admin.broadcast.room' : 'admin.broadcast.global'
      if (!await hasPermission(currentUserId, permission)) return callback?.({ error: 'صلاحيات غير كافية' })

      const socketUser = socketToUser.get(socket.id)

      if (data.roomId) {
        const msg = await createSystemMessage(data.roomId, `📢 ${data.content}`)
        io.to(data.roomId).emit('message:new', msg)
      } else {
        io.emit('broadcast:global', { content: data.content, from: socketUser?.nickname || 'المسؤول', createdAt: Date.now() })
      }

      await logAction({ actionType: 'broadcast.send', actorId: currentUserId, roomId: data.roomId, metadata: { content: data.content } })
      callback?.({ success: true })
    } catch {
      callback?.({ error: 'حدث خطأ' })
    }
  })

  // === DM ===
  socket.on('dm:send', async (data: { targetUserId: string; content: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير متصل' })
      const content = data.content?.trim()
      if (!content || content.length > 500) return callback?.({ error: 'الرسالة غير صالحة' })

      if (!await hasPermission(currentUserId, 'chat.send_private_messages')) {
        return callback?.({ error: 'الرسائل الخاصة تتطلب صلاحية' })
      }

      const socketUser = socketToUser.get(socket.id)
      const targetEntry = [...socketToUser.entries()].find(([, u]) => u.id === data.targetUserId)
      if (!targetEntry) return callback?.({ error: 'المستخدم غير متصل' })

      const dmPayload = {
        id: crypto.randomBytes(12).toString('hex'),
        senderId: currentUserId,
        senderName: socketUser?.nickname || '',
        senderAvatar: socketUser?.avatar || '',
        senderRoleColor: socketUser?.roleColor || null,
        senderRoleBadge: socketUser?.roleBadge || null,
        content,
        createdAt: Date.now(),
      }

      io.sockets.sockets.get(targetEntry[0])?.emit('dm:receive', dmPayload)
      socket.emit('dm:sent', { ...dmPayload, targetUserId: data.targetUserId })
      callback?.({ success: true })
    } catch {
      callback?.({ error: 'حدث خطأ' })
    }
  })

  // === ROOM CREATE ===
  socket.on('room:create', async (data: { name: string; description?: string; type?: string }, callback) => {
    try {
      if (!currentUserId) return callback?.({ error: 'غير متصل' })
      if (!await hasPermission(currentUserId, 'room.create')) return callback?.({ error: 'لا تملك صلاحية إنشاء غرف' })

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
    } catch {
      callback?.({ error: 'حدث خطأ' })
    }
  })

  // === TYPING ===
  socket.on('typing:start', () => {
    const su = socketToUser.get(socket.id)
    if (su?.currentRoom) socket.to(su.currentRoom).emit('typing:update', { userId: su.id, nickname: su.nickname, typing: true })
  })

  socket.on('typing:stop', () => {
    const su = socketToUser.get(socket.id)
    if (su?.currentRoom) socket.to(su.currentRoom).emit('typing:update', { userId: su.id, nickname: su.nickname, typing: false })
  })

  // === DISCONNECT ===
  socket.on('disconnect', async () => {
    try {
      const su = socketToUser.get(socket.id)
      if (!su) return

      if (su.currentRoom) {
        await Member.deleteOne({ roomId: su.currentRoom, userId: su.id })
        const leaveMsg = await createSystemMessage(su.currentRoom, `${su.nickname} غادر الغرفة`)
        io.to(su.currentRoom).emit('message:new', leaveMsg)
        io.to(su.currentRoom).emit('room:members', await getRoomMembersForClient(su.currentRoom))
      }

      await Session.deleteMany({ socketId: socket.id })
      socketToUser.delete(socket.id)
      io.emit('users:count', getOnlineCount())
      io.emit('rooms:update', await getRoomListForClient())
    } catch (err) {
      console.error('disconnect error:', err)
      socketToUser.delete(socket.id)
    }
  })
})

// --- Serve client build in production ---
const clientBuildPath = path.join(__dirname, '../../client/dist')
app.use(express.static(clientBuildPath))
app.get('{*path}', (_req, res, next) => {
  if (_req.path.startsWith('/api') || _req.path.startsWith('/socket.io')) return next()
  res.sendFile(path.join(clientBuildPath, 'index.html'))
})

// --- Startup ---
const PORT = parseInt(process.env.PORT || '3001')

async function start() {
  await connectDB()
  await seedRoles()
  await seedRooms()
  await seedSuperAdmin()
  await seedPlans()

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

start().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})
