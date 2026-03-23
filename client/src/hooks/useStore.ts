import { create } from 'zustand'

export interface ChatUser {
  id: string
  nickname: string
  avatar: string
  type?: 'guest' | 'member' | 'staff'
  permissions?: string[]
  roleColor?: string | null
  roleBadge?: string | null
  visibility?: string
  statusText?: string
  countryCode?: string | null
  lastIp?: string
  roomRole?: string
}

export interface ChatRoom {
  id: string
  name: string
  description: string
  type: 'text' | 'voice' | 'hybrid'
  maxMembers: number
  memberCount: number
  featured: boolean
  coverImage: string | null
}

export interface ChatMessage {
  id: string
  roomId: string
  senderId: string
  senderName: string
  senderAvatar: string
  senderRoleColor?: string | null
  senderRoleBadge?: string | null
  type: 'text' | 'system' | 'media'
  content: string
  createdAt: number
}

interface TypingUser {
  userId: string
  nickname: string
}

interface AppState {
  user: ChatUser | null
  setUser: (user: ChatUser | null) => void

  onlineCount: number
  setOnlineCount: (count: number) => void

  onlineUsers: ChatUser[]
  setOnlineUsers: (users: ChatUser[]) => void

  rooms: ChatRoom[]
  setRooms: (rooms: ChatRoom[]) => void
  currentRoom: { id: string; name: string; description: string; type: string } | null
  setCurrentRoom: (room: { id: string; name: string; description: string; type: string } | null) => void

  messages: ChatMessage[]
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void

  members: ChatUser[]
  setMembers: (members: ChatUser[]) => void

  typingUsers: TypingUser[]
  setTypingUser: (userId: string, nickname: string, typing: boolean) => void

  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  onlineCount: 0,
  setOnlineCount: (onlineCount) => set({ onlineCount }),

  onlineUsers: [],
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),

  rooms: [],
  setRooms: (rooms) => set({ rooms }),
  currentRoom: null,
  setCurrentRoom: (currentRoom) => set({ currentRoom }),

  messages: [],
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

  members: [],
  setMembers: (members) => set({ members }),

  typingUsers: [],
  setTypingUser: (userId, nickname, typing) =>
    set((state) => {
      if (typing) {
        if (state.typingUsers.some((t) => t.userId === userId)) return state
        return { typingUsers: [...state.typingUsers, { userId, nickname }] }
      }
      return { typingUsers: state.typingUsers.filter((t) => t.userId !== userId) }
    }),

  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}))
