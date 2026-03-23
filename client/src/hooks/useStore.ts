import { create } from 'zustand'

export interface ChatUser {
  id: string
  nickname: string
  avatar: string
  type?: 'guest' | 'member' | 'admin'
  systemRole?: string
  membershipPlan?: string
  nicknameColor?: string | null
  badge?: string | null
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
  senderNicknameColor?: string | null
  senderBadge?: string | null
  senderHasBubbleStyle?: boolean
  type: 'text' | 'system' | 'media'
  content: string
  createdAt: number
}

interface TypingUser {
  userId: string
  nickname: string
}

interface AppState {
  // Auth
  user: ChatUser | null
  setUser: (user: ChatUser | null) => void

  // Online
  onlineCount: number
  setOnlineCount: (count: number) => void

  // Rooms
  rooms: ChatRoom[]
  setRooms: (rooms: ChatRoom[]) => void
  currentRoom: { id: string; name: string; description: string; type: string } | null
  setCurrentRoom: (room: { id: string; name: string; description: string; type: string } | null) => void

  // Messages
  messages: ChatMessage[]
  setMessages: (messages: ChatMessage[]) => void
  addMessage: (message: ChatMessage) => void

  // Members
  members: ChatUser[]
  setMembers: (members: ChatUser[]) => void

  // Typing
  typingUsers: TypingUser[]
  setTypingUser: (userId: string, nickname: string, typing: boolean) => void

  // UI
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),

  onlineCount: 0,
  setOnlineCount: (onlineCount) => set({ onlineCount }),

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
