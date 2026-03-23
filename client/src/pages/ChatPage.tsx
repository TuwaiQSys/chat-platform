import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '@/lib/socket'
import { useStore, type ChatMessage, type ChatUser } from '@/hooks/useStore'
import UserActionMenu from '@/components/UserActionMenu'

export default function ChatPage() {
  const {
    user, currentRoom, messages, members, rooms, typingUsers, onlineCount,
    setCurrentRoom, setMessages, setMembers, setRooms, setOnlineCount, setUser,
    addMessage,
  } = useStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [entryEffect, setEntryEffect] = useState<{ nickname: string; badge: string | null; effect: string } | null>(null)
  const [actionMenu, setActionMenu] = useState<{ target: ChatUser; position: { x: number; y: number } } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>()
  const navigate = useNavigate()

  // Redirect if not logged in
  useEffect(() => {
    if (!user) navigate('/')
  }, [user, navigate])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Fetch rooms
  useEffect(() => {
    fetch('/api/rooms')
      .then((r) => r.json())
      .then((data) => { setRooms(data.rooms); setOnlineCount(data.totalOnline) })
      .catch(() => {})
  }, [setRooms, setOnlineCount])

  // Moderation + entry effect listeners
  useEffect(() => {
    const onKicked = () => { showToast('تم طردك من الغرفة'); leaveCurrentRoom() }
    const onBanned = (d: any) => { showToast(`تم حظرك: ${d.reason}`); leaveCurrentRoom() }
    const onGlobalBanned = () => { socket.disconnect(); navigate('/') }
    const onMuted = (d: any) => showToast(`تم كتمك: ${d.reason}`)
    const onDeleted = (d: any) => useStore.setState((s) => ({ messages: s.messages.filter((m) => m.id !== d.messageId) }))
    const onEntry = (d: any) => { setEntryEffect(d); setTimeout(() => setEntryEffect(null), 3000) }
    const onBroadcast = (d: any) => showToast(`📢 ${d.from}: ${d.content}`)

    socket.on('room:kicked', onKicked)
    socket.on('room:banned', onBanned)
    socket.on('user:banned', onGlobalBanned)
    socket.on('room:muted', onMuted)
    socket.on('message:deleted', onDeleted)
    socket.on('user:entry-effect', onEntry)
    socket.on('broadcast:global', onBroadcast)

    return () => {
      socket.off('room:kicked', onKicked)
      socket.off('room:banned', onBanned)
      socket.off('user:banned', onGlobalBanned)
      socket.off('room:muted', onMuted)
      socket.off('message:deleted', onDeleted)
      socket.off('user:entry-effect', onEntry)
      socket.off('broadcast:global', onBroadcast)
    }
  }, [navigate])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  const leaveCurrentRoom = () => {
    setCurrentRoom(null)
    setMessages([])
    setMembers([])
  }

  const joinRoom = (roomId: string) => {
    socket.emit('room:join', { roomId }, (res: any) => {
      if (res.error) return showToast(res.error)
      setCurrentRoom(res.room)
      setMessages(res.messages)
      setMembers(res.members)
    })
  }

  const sendMessage = () => {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    socket.emit('message:send', { content }, (res: any) => {
      setSending(false)
      if (res.error) return showToast(res.error)
      setInput('')
      inputRef.current?.focus()
    })
    socket.emit('typing:stop')
  }

  const handleInputChange = (value: string) => {
    setInput(value)
    socket.emit('typing:start')
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => socket.emit('typing:stop'), 2000)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    socket.disconnect()
    setUser(null)
    setCurrentRoom(null)
    setMessages([])
    setMembers([])
    navigate('/')
  }

  const othersTyping = typingUsers.filter((t) => t.userId !== user?.id)

  if (!user) return null

  return (
    <div className="flex h-full flex-col">
      {/* Toast */}
      {toast && (
        <div className="absolute left-1/2 top-3 z-50 -translate-x-1/2 rounded bg-red-600 px-4 py-2 text-sm text-white shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Entry effect */}
      {entryEffect && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center animate-fade-in">
          <div className="rounded-lg bg-amber-100/90 px-6 py-3 text-center shadow-xl border border-amber-300">
            <p className="text-xl">{entryEffect.badge || '✨'}</p>
            <p className="text-sm font-bold text-amber-800">{entryEffect.nickname} دخل الغرفة</p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between bg-gradient-to-l from-amber-700 to-amber-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">شات</h1>
          <span className="rounded bg-amber-900/40 px-2 py-0.5 text-xs text-amber-100">
            🟢 {onlineCount} متصل
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-amber-100">{user.nickname}</span>
          {(user as any).type === 'admin' && (
            <button onClick={() => navigate('/admin')} className="rounded bg-amber-900/40 px-2 py-1 text-xs text-amber-100 hover:bg-amber-900/60">
              لوحة التحكم
            </button>
          )}
          <button onClick={handleLogout} className="rounded bg-amber-900/40 px-2 py-1 text-xs text-amber-100 hover:bg-amber-900/60">
            خروج
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat area - left side */}
        <div className="flex flex-1 flex-col bg-[#f5f0e8]">
          {/* Room name bar */}
          {currentRoom && (
            <div className="border-b border-amber-200 bg-[#ebe4d4] px-4 py-2 flex items-center justify-between">
              <span className="text-sm font-bold text-amber-900">{currentRoom.name}</span>
              <span className="text-xs text-gray-500">{members.length} عضو</span>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {!currentRoom ? (
              <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                اختر غرفة من القائمة
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageRow
                    key={msg.id}
                    message={msg}
                    isOwn={msg.senderId === user?.id}
                    members={members}
                    onUsernameClick={(target, e) => {
                      if (target.id !== user?.id) setActionMenu({ target, position: { x: e.clientX, y: e.clientY } })
                    }}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Typing */}
          {othersTyping.length > 0 && (
            <div className="px-3 pb-1">
              <p className="text-xs text-gray-400">
                {othersTyping.length === 1 ? `${othersTyping[0].nickname} يكتب...` : `${othersTyping.length} أشخاص يكتبون...`}
              </p>
            </div>
          )}

          {/* Input bar */}
          {currentRoom && (
            <div className="border-t border-amber-200 bg-[#ebe4d4] p-2 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="اكتب رسالتك هنا..."
                maxLength={500}
                className="flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                dir="auto"
                autoFocus
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="rounded bg-amber-700 px-4 py-2 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-40"
              >
                إرسال
              </button>
            </div>
          )}
        </div>

        {/* Right sidebar - rooms + members */}
        <div className="hidden w-64 flex-col border-r border-amber-200 bg-[#ebe4d4] sm:flex">
          {/* Rooms header */}
          <div className="border-b border-amber-200 bg-amber-800 px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-bold text-white">غرف الدردشة</span>
            <span className="text-xs text-amber-200">{rooms.length}</span>
          </div>

          {/* Room list */}
          <div className="flex-1 overflow-y-auto">
            {rooms.map((room) => {
              const isActive = currentRoom?.id === room.id
              const isFull = room.memberCount >= room.maxMembers
              return (
                <button
                  key={room.id}
                  onClick={() => joinRoom(room.id)}
                  disabled={isFull && !isActive}
                  className={`w-full border-b border-amber-100/50 px-3 py-2.5 text-right transition-colors ${
                    isActive ? 'bg-amber-100' : 'hover:bg-amber-50 bg-[#f5f0e8]'
                  } disabled:opacity-40`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${isActive ? 'text-amber-900' : 'text-gray-700'}`}>
                      {room.name}
                    </span>
                    <span className={`text-xs ${isFull ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                      🟢{room.memberCount}/{room.maxMembers}
                    </span>
                  </div>
                  {room.description && (
                    <p className="text-[11px] text-gray-400 mt-0.5">{room.description}</p>
                  )}
                </button>
              )
            })}
          </div>

          {/* Members list (when in a room) */}
          {currentRoom && members.length > 0 && (
            <>
              <div className="border-t border-b border-amber-200 bg-amber-800 px-3 py-2 flex items-center justify-between">
                <span className="text-sm font-bold text-white">المتواجدون</span>
                <span className="text-xs text-amber-200">{members.length}</span>
              </div>
              <div className="max-h-48 overflow-y-auto bg-[#f5f0e8]">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2 border-b border-amber-100/30 px-3 py-1.5 cursor-pointer hover:bg-amber-50"
                    onClick={(e) => {
                      if (member.id !== user?.id) setActionMenu({ target: member, position: { x: e.clientX, y: e.clientY } })
                    }}
                  >
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: member.avatar }}
                    >
                      {member.nickname.charAt(0)}
                    </div>
                    <span
                      className="text-xs font-medium truncate"
                      style={{ color: member.nicknameColor || '#4a5568' }}
                    >
                      {member.badge && <span className="ml-1">{member.badge}</span>}
                      {member.nickname}
                      {member.id === user?.id && <span className="text-gray-400"> (أنت)</span>}
                    </span>
                    <span className="mr-auto h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
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

function MessageRow({
  message, isOwn, members, onUsernameClick,
}: {
  message: ChatMessage
  isOwn: boolean
  members: ChatUser[]
  onUsernameClick: (target: ChatUser, e: React.MouseEvent) => void
}) {
  if (message.type === 'system') {
    return (
      <div className="py-1 text-center">
        <span className="text-[11px] text-gray-400">{message.content}</span>
      </div>
    )
  }

  const sender = members.find((m) => m.id === message.senderId)
  const nicknameColor = message.senderNicknameColor || sender?.nicknameColor
  const badge = message.senderBadge || sender?.badge
  const hasBubble = message.senderHasBubbleStyle

  const time = new Date(message.createdAt).toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className="flex items-start gap-2 py-1 animate-fade-in">
      {/* Avatar */}
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-xs font-bold text-white cursor-pointer"
        style={{ background: message.senderAvatar }}
        onClick={(e) => { if (!isOwn && sender) onUsernameClick(sender, e) }}
      >
        {message.senderName.charAt(0)}
      </div>

      <div className="flex-1 min-w-0">
        {/* Name line */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-bold cursor-pointer hover:underline"
            style={{ color: nicknameColor || '#b7791f' }}
            onClick={(e) => { if (!isOwn && sender) onUsernameClick(sender, e) }}
          >
            {badge && <span className="ml-0.5">{badge}</span>}
            {message.senderName}
          </span>
          <span className="text-[10px] text-gray-400">{time}</span>
        </div>

        {/* Message content */}
        <p
          className={`text-sm text-gray-700 leading-relaxed ${
            hasBubble && nicknameColor
              ? 'mt-0.5 rounded px-2 py-1 inline-block'
              : ''
          }`}
          style={
            hasBubble && nicknameColor
              ? { background: `${nicknameColor}12`, borderRight: `2px solid ${nicknameColor}40` }
              : undefined
          }
        >
          {message.content}
        </p>
      </div>
    </div>
  )
}
