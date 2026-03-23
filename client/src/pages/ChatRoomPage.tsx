import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Send, Users, X, Hash } from 'lucide-react'
import { socket } from '@/lib/socket'
import { useStore, type ChatMessage, type ChatUser } from '@/hooks/useStore'

export default function ChatRoomPage() {
  const {
    user,
    currentRoom,
    messages,
    members,
    typingUsers,
    sidebarOpen,
    setSidebarOpen,
    setCurrentRoom,
    setMessages,
    setMembers,
  } = useStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>()
  const navigate = useNavigate()

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Leave room
  const leaveRoom = useCallback(() => {
    if (currentRoom) {
      socket.emit('room:leave', { roomId: currentRoom.id })
    }
    setCurrentRoom(null)
    setMessages([])
    setMembers([])
    navigate('/lobby')
  }, [currentRoom, setCurrentRoom, setMessages, setMembers, navigate])

  // Send message
  const sendMessage = () => {
    const content = input.trim()
    if (!content || sending) return

    setSending(true)
    socket.emit('message:send', { content }, (res: any) => {
      setSending(false)
      if (!res.error) {
        setInput('')
        inputRef.current?.focus()
      }
    })

    socket.emit('typing:stop')
  }

  // Typing indicator
  const handleInputChange = (value: string) => {
    setInput(value)
    socket.emit('typing:start')
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => socket.emit('typing:stop'), 2000)
  }

  // Filter typing users (exclude self)
  const othersTyping = typingUsers.filter((t) => t.userId !== user?.id)

  // Redirect if no room (via effect to avoid setState-during-render)
  useEffect(() => {
    if (!currentRoom) navigate('/lobby')
  }, [currentRoom, navigate])

  if (!currentRoom) return null

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/5 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={leaveRoom} className="btn-ghost p-1.5 sm:p-2">
            <ArrowRight className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/10">
              <Hash className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white sm:text-base">{currentRoom.name}</h2>
              <p className="text-[10px] text-white/30 sm:text-xs">{members.length} عضو</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="btn-ghost relative p-1.5 sm:p-2"
        >
          <Users className="h-5 w-5" />
          <span className="absolute -top-0.5 -left-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
            {members.length}
          </span>
        </button>
      </header>

      <div className="relative flex flex-1 overflow-hidden">
        {/* Messages area */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
            <div className="mx-auto max-w-2xl space-y-1">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === user?.id} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Typing indicator */}
          {othersTyping.length > 0 && (
            <div className="px-4 pb-1">
              <p className="text-xs text-white/30 animate-fade-in">
                {othersTyping.length === 1
                  ? `${othersTyping[0].nickname} يكتب...`
                  : `${othersTyping.length} أشخاص يكتبون...`}
              </p>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-white/5 p-2 sm:p-3">
            <div className="mx-auto flex max-w-2xl items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="اكتب رسالتك هنا..."
                maxLength={500}
                className="input-dark flex-1 py-2.5 text-sm sm:text-base"
                dir="auto"
                autoFocus
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed sm:h-11 sm:w-11"
              >
                <Send className="h-4 w-4 sm:h-5 sm:w-5 rotate-180" />
              </button>
            </div>
          </div>
        </div>

        {/* Members sidebar */}
        {sidebarOpen && (
          <>
            {/* Backdrop (mobile) */}
            <div
              className="absolute inset-0 z-10 bg-black/50 sm:hidden"
              onClick={() => setSidebarOpen(false)}
            />

            <aside className="absolute left-0 top-0 z-20 h-full w-64 animate-slide-in border-r border-white/5 bg-[#0d0d18] sm:relative sm:w-56 sm:animate-none">
              <div className="flex items-center justify-between border-b border-white/5 px-3 py-2.5">
                <h3 className="text-sm font-semibold text-white/70">الأعضاء ({members.length})</h3>
                <button onClick={() => setSidebarOpen(false)} className="btn-ghost p-1 sm:hidden">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="overflow-y-auto p-2">
                {members.map((member) => (
                  <MemberItem key={member.id} member={member} isYou={member.id === user?.id} />
                ))}
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  )
}

function MessageBubble({ message, isOwn }: { message: ChatMessage; isOwn: boolean }) {
  if (message.type === 'system') {
    return (
      <div className="flex justify-center py-1.5">
        <span className="rounded-full bg-white/[0.03] px-3 py-1 text-[11px] text-white/25">
          {message.content}
        </span>
      </div>
    )
  }

  const time = new Date(message.createdAt).toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className={`flex gap-2 py-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}>
      {/* Avatar */}
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ background: message.senderAvatar }}
      >
        {message.senderName.charAt(0)}
      </div>

      <div className={`max-w-[75%] sm:max-w-[65%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Name + time */}
        <div className={`flex items-center gap-2 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          <span className="text-xs font-medium text-white/40">{message.senderName}</span>
          <span className="text-[10px] text-white/15">{time}</span>
        </div>

        {/* Bubble */}
        <div
          className={`mt-0.5 rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            isOwn
              ? 'rounded-tl-md bg-indigo-600/20 text-indigo-100'
              : 'rounded-tr-md bg-white/[0.04] text-white/80'
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}

function MemberItem({ member, isYou }: { member: ChatUser; isYou: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white/[0.03] transition-colors">
      <div className="relative">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: member.avatar }}
        >
          {member.nickname.charAt(0)}
        </div>
        <div className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d0d18] bg-emerald-500" />
      </div>
      <span className="truncate text-sm text-white/60">
        {member.nickname}
        {isYou && <span className="mr-1 text-[10px] text-white/20">(أنت)</span>}
      </span>
    </div>
  )
}
