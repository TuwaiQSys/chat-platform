import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Send, Users, X, Hash, Shield } from 'lucide-react'
import { socket } from '@/lib/socket'
import { useStore, type ChatMessage, type ChatUser } from '@/hooks/useStore'
import UserActionMenu from '@/components/UserActionMenu'

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
  const [toast, setToast] = useState<string | null>(null)
  const [entryEffect, setEntryEffect] = useState<{ userId: string; nickname: string; effect: string; badge: string | null } | null>(null)
  const [actionMenu, setActionMenu] = useState<{ target: ChatUser; position: { x: number; y: number } } | null>(null)
  const showToastFn = useRef((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>()
  const navigate = useNavigate()

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Moderation event listeners
  useEffect(() => {
    const onKicked = (data: { roomId: string; reason: string }) => {
      showToast(`تم طردك: ${data.reason}`)
      setCurrentRoom(null)
      setMessages([])
      setMembers([])
      navigate('/lobby')
    }

    const onBanned = (data: { roomId: string; reason: string }) => {
      showToast(`تم حظرك: ${data.reason}`)
      setCurrentRoom(null)
      setMessages([])
      setMembers([])
      navigate('/lobby')
    }

    const onGlobalBanned = (data: { reason: string }) => {
      showToast(`تم حظرك نهائيًا: ${data.reason}`)
      socket.disconnect()
      navigate('/')
    }

    const onMuted = (data: { roomId: string; reason: string; duration?: number }) => {
      const dur = data.duration ? `${data.duration} دقيقة` : 'بشكل دائم'
      showToast(`تم كتمك لمدة ${dur}: ${data.reason}`)
    }

    const onMessageDeleted = (data: { messageId: string }) => {
      useStore.setState((state) => ({
        messages: state.messages.filter((m) => m.id !== data.messageId),
      }))
    }

    const onEntryEffect = (data: { userId: string; nickname: string; effect: string; badge: string | null }) => {
      setEntryEffect(data)
      setTimeout(() => setEntryEffect(null), 3000)
    }

    const onBroadcast = (data: { content: string; from: string }) => {
      showToastFn.current(`📢 ${data.from}: ${data.content}`)
    }

    socket.on('room:kicked', onKicked)
    socket.on('room:banned', onBanned)
    socket.on('user:banned', onGlobalBanned)
    socket.on('room:muted', onMuted)
    socket.on('message:deleted', onMessageDeleted)
    socket.on('user:entry-effect', onEntryEffect)
    socket.on('broadcast:global', onBroadcast)

    return () => {
      socket.off('room:kicked', onKicked)
      socket.off('room:banned', onBanned)
      socket.off('user:banned', onGlobalBanned)
      socket.off('room:muted', onMuted)
      socket.off('message:deleted', onMessageDeleted)
      socket.off('user:entry-effect', onEntryEffect)
      socket.off('broadcast:global', onBroadcast)
    }
  }, [navigate, setCurrentRoom, setMessages, setMembers])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

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
      if (res.error) {
        showToast(res.error)
        return
      }
      setInput('')
      inputRef.current?.focus()
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

  // Username click for action menu
  const handleUsernameClick = (target: ChatUser, e: React.MouseEvent) => {
    if (target.id === user?.id) return
    setActionMenu({ target, position: { x: e.clientX, y: e.clientY } })
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
      {/* Toast notification */}
      {toast && (
        <div className="absolute left-1/2 top-14 z-50 -translate-x-1/2 animate-fade-in rounded-xl border border-red-500/20 bg-red-900/80 px-4 py-2.5 text-sm text-red-200 shadow-lg backdrop-blur">
          {toast}
        </div>
      )}

      {/* Entry effect overlay */}
      {entryEffect && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center animate-fade-in">
          <div className={`rounded-2xl px-8 py-4 text-center backdrop-blur-md ${
            entryEffect.effect === 'sparkle' ? 'bg-purple-600/20 ring-1 ring-purple-400/30' : 'bg-amber-600/20 ring-1 ring-amber-400/30'
          }`}>
            <p className="text-2xl mb-1">{entryEffect.badge || '✨'}</p>
            <p className={`text-lg font-bold ${entryEffect.effect === 'sparkle' ? 'text-purple-300' : 'text-amber-300'}`}>
              {entryEffect.nickname}
            </p>
            <p className="text-xs text-white/40 mt-1">انضم إلى الغرفة</p>
          </div>
        </div>
      )}

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
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwn={msg.senderId === user?.id}
                  onUsernameClick={handleUsernameClick}
                  members={members}
                />
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
                  <MemberItem
                    key={member.id}
                    member={member}
                    isYou={member.id === user?.id}
                    onClick={(e) => handleUsernameClick(member, e)}
                  />
                ))}
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Action menu */}
      {actionMenu && currentRoom && (
        <UserActionMenu
          target={actionMenu.target}
          roomId={currentRoom.id}
          position={actionMenu.position}
          onClose={() => setActionMenu(null)}
        />
      )}
    </div>
  )
}

function MessageBubble({
  message,
  isOwn,
  onUsernameClick,
  members,
}: {
  message: ChatMessage
  isOwn: boolean
  onUsernameClick: (target: ChatUser, e: React.MouseEvent) => void
  members: ChatUser[]
}) {
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

  const senderMember = members.find((m) => m.id === message.senderId)
  const nicknameColor = message.senderNicknameColor || senderMember?.nicknameColor
  const badge = message.senderBadge || senderMember?.badge
  const hasBubble = message.senderHasBubbleStyle

  return (
    <div className={`flex gap-2 py-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'} animate-fade-in`}>
      {/* Avatar */}
      <div
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${!isOwn ? 'cursor-pointer hover:ring-2 hover:ring-white/20' : ''}`}
        style={{ background: message.senderAvatar }}
        onClick={(e) => {
          if (!isOwn && senderMember) onUsernameClick(senderMember, e)
        }}
      >
        {message.senderName.charAt(0)}
      </div>

      <div className={`max-w-[75%] sm:max-w-[65%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* Name + badge + time */}
        <div className={`flex items-center gap-1.5 px-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
          <span
            className={`text-xs font-semibold ${!isOwn ? 'cursor-pointer hover:brightness-125' : ''}`}
            style={{ color: nicknameColor || 'rgba(255,255,255,0.4)' }}
            onClick={(e) => {
              if (!isOwn && senderMember) onUsernameClick(senderMember, e)
            }}
          >
            {message.senderName}
          </span>
          {badge && <span className="text-[11px]">{badge}</span>}
          {senderMember?.systemRole && senderMember.systemRole !== 'user' && (
            <Shield className="h-3 w-3 text-indigo-400" />
          )}
          <span className="text-[10px] text-white/15">{time}</span>
        </div>

        {/* Bubble */}
        <div
          className={`mt-0.5 rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
            isOwn
              ? 'rounded-tl-md bg-indigo-600/20 text-indigo-100'
              : hasBubble && nicknameColor
                ? 'rounded-tr-md text-white/90'
                : 'rounded-tr-md bg-white/[0.04] text-white/80'
          }`}
          style={
            !isOwn && hasBubble && nicknameColor
              ? { background: `${nicknameColor}15`, borderLeft: `2px solid ${nicknameColor}40` }
              : undefined
          }
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}

function MemberItem({ member, isYou, onClick }: { member: ChatUser; isYou: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${isYou ? '' : 'cursor-pointer hover:bg-white/[0.05]'}`}
      onClick={isYou ? undefined : onClick}
    >
      <div className="relative">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: member.avatar }}
        >
          {member.nickname.charAt(0)}
        </div>
        <div className="absolute -bottom-0.5 -left-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d0d18] bg-emerald-500" />
      </div>
      <div className="flex items-center gap-1 truncate">
        <span
          className="truncate text-sm font-medium"
          style={{ color: member.nicknameColor || 'rgba(255,255,255,0.6)' }}
        >
          {member.nickname}
        </span>
        {member.badge && <span className="text-[11px] shrink-0">{member.badge}</span>}
        {isYou && <span className="text-[10px] text-white/20 shrink-0">(أنت)</span>}
        {member.systemRole && member.systemRole !== 'user' && (
          <Shield className="h-3 w-3 shrink-0 text-indigo-400" />
        )}
      </div>
    </div>
  )
}
