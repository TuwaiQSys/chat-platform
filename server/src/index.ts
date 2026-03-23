import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { nanoid } from 'nanoid'

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})

app.use(cors())
app.use(express.json())

// --- In-memory state (will be replaced by MongoDB) ---

interface User {
  id: string
  nickname: string
  avatar: string
  socketId: string
  currentRoom: string | null
  systemRole: 'user' | 'moderator' | 'admin'
  status: string
  joinedAt: number
}

interface Room {
  id: string
  name: string
  description: string
  type: 'text' | 'voice' | 'hybrid'
  maxMembers: number
  members: Set<string>
  createdBy: string
  createdAt: number
  coverImage: string | null
  featured: boolean
}

interface Message {
  id: string
  roomId: string
  senderId: string
  senderName: string
  senderAvatar: string
  type: 'text' | 'system' | 'media'
  content: string
  createdAt: number
}

const users = new Map<string, User>()
const rooms = new Map<string, Room>()
const messages = new Map<string, Message[]>()

// Seed default rooms
const defaultRooms: Omit<Room, 'members'>[] = [
  { id: 'general-1', name: 'الغرفة العامة (1)', description: 'غرفة عامة للجميع', type: 'text', maxMembers: 40, createdBy: 'system', createdAt: Date.now(), coverImage: null, featured: true },
  { id: 'general-2', name: 'الغرفة العامة (2)', description: 'غرفة عامة للجميع', type: 'text', maxMembers: 40, createdBy: 'system', createdAt: Date.now(), coverImage: null, featured: false },
  { id: 'general-3', name: 'الغرفة العامة (3)', description: 'غرفة عامة للجميع', type: 'text', maxMembers: 30, createdBy: 'system', createdAt: Date.now(), coverImage: null, featured: false },
  { id: 'chill', name: 'استراحة', description: 'غرفة للاسترخاء والدردشة', type: 'text', maxMembers: 20, createdBy: 'system', createdAt: Date.now(), coverImage: null, featured: false },
  { id: 'gaming', name: 'قيمرز', description: 'غرفة الألعاب', type: 'text', maxMembers: 30, createdBy: 'system', createdAt: Date.now(), coverImage: null, featured: false },
]

for (const r of defaultRooms) {
  rooms.set(r.id, { ...r, members: new Set() })
  messages.set(r.id, [])
}

// Avatar generation
const avatarColors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6']

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return avatarColors[Math.abs(hash) % avatarColors.length]
}

// --- REST API ---

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', users: users.size, rooms: rooms.size })
})

app.get('/api/rooms', (_req, res) => {
  const roomList = Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type,
    maxMembers: r.maxMembers,
    memberCount: r.members.size,
    featured: r.featured,
    coverImage: r.coverImage,
  }))
  res.json({ rooms: roomList, totalOnline: users.size })
})

// --- Socket.IO ---

io.on('connection', (socket) => {
  let currentUser: User | null = null

  socket.on('guest:join', (data: { nickname: string }, callback) => {
    const nickname = data.nickname?.trim()
    if (!nickname || nickname.length < 2 || nickname.length > 20) {
      return callback?.({ error: 'الاسم يجب أن يكون بين 2 و 20 حرف' })
    }

    // Check duplicate nickname
    for (const u of users.values()) {
      if (u.nickname === nickname) {
        return callback?.({ error: 'هذا الاسم مستخدم بالفعل' })
      }
    }

    const user: User = {
      id: nanoid(12),
      nickname,
      avatar: getAvatarColor(nickname),
      socketId: socket.id,
      currentRoom: null,
      systemRole: 'user',
      status: 'متصل',
      joinedAt: Date.now(),
    }

    users.set(user.id, user)
    currentUser = user

    callback?.({ user: { id: user.id, nickname: user.nickname, avatar: user.avatar } })
    io.emit('users:count', users.size)
  })

  socket.on('room:join', (data: { roomId: string }, callback) => {
    if (!currentUser) return callback?.({ error: 'غير مسجل الدخول' })

    const room = rooms.get(data.roomId)
    if (!room) return callback?.({ error: 'الغرفة غير موجودة' })
    if (room.members.size >= room.maxMembers) return callback?.({ error: 'الغرفة ممتلئة' })

    // Leave current room
    if (currentUser.currentRoom) {
      const prevRoom = rooms.get(currentUser.currentRoom)
      if (prevRoom) {
        prevRoom.members.delete(currentUser.id)
        socket.leave(currentUser.currentRoom)

        const leaveMsg: Message = {
          id: nanoid(),
          roomId: currentUser.currentRoom,
          senderId: 'system',
          senderName: 'النظام',
          senderAvatar: '',
          type: 'system',
          content: `${currentUser.nickname} غادر الغرفة`,
          createdAt: Date.now(),
        }
        messages.get(currentUser.currentRoom)?.push(leaveMsg)
        io.to(currentUser.currentRoom).emit('message:new', leaveMsg)
        io.to(currentUser.currentRoom).emit('room:members', getRoomMembers(currentUser.currentRoom))
      }
    }

    // Join new room
    room.members.add(currentUser.id)
    currentUser.currentRoom = data.roomId
    socket.join(data.roomId)

    const joinMsg: Message = {
      id: nanoid(),
      roomId: data.roomId,
      senderId: 'system',
      senderName: 'النظام',
      senderAvatar: '',
      type: 'system',
      content: `${currentUser.nickname} انضم إلى الغرفة`,
      createdAt: Date.now(),
    }
    const roomMessages = messages.get(data.roomId) || []
    roomMessages.push(joinMsg)
    messages.set(data.roomId, roomMessages)

    io.to(data.roomId).emit('message:new', joinMsg)
    io.to(data.roomId).emit('room:members', getRoomMembers(data.roomId))

    // Send last 50 messages to joining user
    const recentMessages = roomMessages.slice(-50)
    callback?.({
      room: { id: room.id, name: room.name, description: room.description, type: room.type },
      messages: recentMessages,
      members: getRoomMembers(data.roomId),
    })

    // Broadcast updated room list
    io.emit('rooms:update', getRoomList())
  })

  socket.on('message:send', (data: { content: string }, callback) => {
    if (!currentUser || !currentUser.currentRoom) return callback?.({ error: 'غير متصل بغرفة' })

    const content = data.content?.trim()
    if (!content || content.length > 500) return callback?.({ error: 'الرسالة غير صالحة' })

    const msg: Message = {
      id: nanoid(),
      roomId: currentUser.currentRoom,
      senderId: currentUser.id,
      senderName: currentUser.nickname,
      senderAvatar: currentUser.avatar,
      type: 'text',
      content,
      createdAt: Date.now(),
    }

    const roomMessages = messages.get(currentUser.currentRoom) || []
    roomMessages.push(msg)
    if (roomMessages.length > 200) roomMessages.splice(0, roomMessages.length - 200)
    messages.set(currentUser.currentRoom, roomMessages)

    io.to(currentUser.currentRoom).emit('message:new', msg)
    callback?.({ id: msg.id })
  })

  socket.on('typing:start', () => {
    if (currentUser?.currentRoom) {
      socket.to(currentUser.currentRoom).emit('typing:update', {
        userId: currentUser.id,
        nickname: currentUser.nickname,
        typing: true,
      })
    }
  })

  socket.on('typing:stop', () => {
    if (currentUser?.currentRoom) {
      socket.to(currentUser.currentRoom).emit('typing:update', {
        userId: currentUser.id,
        nickname: currentUser.nickname,
        typing: false,
      })
    }
  })

  socket.on('disconnect', () => {
    if (!currentUser) return

    if (currentUser.currentRoom) {
      const room = rooms.get(currentUser.currentRoom)
      if (room) {
        room.members.delete(currentUser.id)
        const leaveMsg: Message = {
          id: nanoid(),
          roomId: currentUser.currentRoom,
          senderId: 'system',
          senderName: 'النظام',
          senderAvatar: '',
          type: 'system',
          content: `${currentUser.nickname} غادر الغرفة`,
          createdAt: Date.now(),
        }
        messages.get(currentUser.currentRoom)?.push(leaveMsg)
        io.to(currentUser.currentRoom).emit('message:new', leaveMsg)
        io.to(currentUser.currentRoom).emit('room:members', getRoomMembers(currentUser.currentRoom))
      }
    }

    users.delete(currentUser.id)
    io.emit('users:count', users.size)
    io.emit('rooms:update', getRoomList())
  })
})

function getRoomMembers(roomId: string) {
  const room = rooms.get(roomId)
  if (!room) return []
  return Array.from(room.members)
    .map((uid) => users.get(uid))
    .filter(Boolean)
    .map((u) => ({
      id: u!.id,
      nickname: u!.nickname,
      avatar: u!.avatar,
      systemRole: u!.systemRole,
    }))
}

function getRoomList() {
  return Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type,
    maxMembers: r.maxMembers,
    memberCount: r.members.size,
    featured: r.featured,
    coverImage: r.coverImage,
  }))
}

const PORT = parseInt(process.env.PORT || '3001')
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
