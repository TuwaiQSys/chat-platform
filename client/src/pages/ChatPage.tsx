import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '@/lib/socket'
import { useStore, type ChatMessage, type ChatUser } from '@/hooks/useStore'
import UserActionMenu from '@/components/UserActionMenu'

export default function ChatPage() {
  const {
    user, currentRoom, messages, members, rooms, typingUsers, onlineCount,
    setCurrentRoom, setMessages, setMembers, setRooms, setOnlineCount, setUser, addMessage,
  } = useStore()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [actionMenu, setActionMenu] = useState<{ target: ChatUser; position: { x: number; y: number } } | null>(null)
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null)
  const [bottomTab, setBottomTab] = useState<'rooms' | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>()
  const navigate = useNavigate()

  const userPerms = user?.permissions || []
  const hasMod = userPerms.some(p => p.startsWith('mod.'))
  const hasAdmin = userPerms.some(p => p.startsWith('admin.'))

  useEffect(() => { if (!user) navigate('/') }, [user, navigate])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  useEffect(() => {
    fetch('/api/rooms').then(r => r.json()).then(d => { setRooms(d.rooms); setOnlineCount(d.totalOnline) }).catch(() => {})
  }, [setRooms, setOnlineCount])

  useEffect(() => {
    const onKicked = () => { showToast('تم طردك من الغرفة'); leaveCurrentRoom() }
    const onBanned = (d: any) => { showToast(`تم حظرك: ${d.reason}`); leaveCurrentRoom() }
    const onGlobalBanned = () => { socket.disconnect(); navigate('/') }
    const onMuted = (d: any) => showToast(`تم كتمك: ${d.reason}`)
    const onDeleted = (d: any) => useStore.setState(s => ({ messages: s.messages.filter(m => m.id !== d.messageId) }))
    const onBroadcast = (d: any) => showToast(`📢 ${d.from}: ${d.content}`)

    socket.on('room:kicked', onKicked); socket.on('room:banned', onBanned)
    socket.on('user:banned', onGlobalBanned); socket.on('room:muted', onMuted)
    socket.on('message:deleted', onDeleted); socket.on('broadcast:global', onBroadcast)

    return () => {
      socket.off('room:kicked', onKicked); socket.off('room:banned', onBanned)
      socket.off('user:banned', onGlobalBanned); socket.off('room:muted', onMuted)
      socket.off('message:deleted', onDeleted); socket.off('broadcast:global', onBroadcast)
    }
  }, [navigate])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) }
  const leaveCurrentRoom = () => { setCurrentRoom(null); setMessages([]); setMembers([]) }

  const joinRoom = (roomId: string) => {
    socket.emit('room:join', { roomId }, (res: any) => {
      if (res.error) return showToast(res.error)
      setCurrentRoom(res.room); setMessages(res.messages); setMembers(res.members)
      setBottomTab(null)
    })
  }

  const sendMessage = () => {
    const content = input.trim()
    if (!content || sending) return
    setSending(true)
    socket.emit('message:send', { content }, (res: any) => {
      setSending(false)
      if (res.error) return showToast(res.error)
      setInput(''); inputRef.current?.focus()
    })
    socket.emit('typing:stop')
  }

  const handleInputChange = (v: string) => {
    setInput(v); socket.emit('typing:start')
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => socket.emit('typing:stop'), 2000)
  }

  const doModAction = (action: string, target?: ChatUser) => {
    const t = target || selectedUser
    if (!t || !currentRoom) return
    const reason = prompt('السبب:') || 'مخالفة'
    socket.emit('mod:action', { action, targetUserId: t.id, roomId: currentRoom.id, reason, duration: 15 }, (res: any) => {
      if (res.error) showToast(res.error)
      else showToast('تم تنفيذ الإجراء')
    })
  }

  const handleLogout = () => {
    localStorage.removeItem('token'); socket.disconnect()
    setUser(null); setCurrentRoom(null); setMessages([]); setMembers([])
    navigate('/')
  }

  const othersTyping = typingUsers.filter(t => t.userId !== user?.id)
  if (!user) return null

  return (
    <div className="flex h-full flex-col bg-[#e5e7eb]">
      {/* Toast */}
      {toast && (
        <div className="absolute left-1/2 top-2 z-50 -translate-x-1/2 rounded bg-[#1e2a3a] px-4 py-2 text-sm text-white shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Top bar — dark blue */}
      <div className="flex items-center justify-between bg-[#1e2a3a] px-3 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-white">شات</h1>
          <span className="flex items-center gap-1 rounded bg-[#2a3a4e] px-2 py-0.5 text-[11px] text-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            {onlineCount} متصل
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: user.roleColor || '#93c5fd' }}>
            {user.roleBadge && <span className="ml-1">{user.roleBadge}</span>}
            {user.nickname}
          </span>
          {hasAdmin && (
            <button onClick={() => navigate('/admin')} className="rounded bg-[#2a3a4e] px-2 py-1 text-[10px] text-blue-200 hover:bg-[#3b82f6]">
              لوحة التحكم
            </button>
          )}
          <button onClick={handleLogout} className="rounded bg-[#2a3a4e] px-2 py-1 text-[10px] text-blue-200 hover:bg-red-600">
            خروج
          </button>
        </div>
      </div>

      {/* Room name bar */}
      {currentRoom && (
        <div className="flex items-center justify-between bg-[#3b82f6] px-3 py-1.5 shrink-0">
          <span className="text-sm font-bold text-white">{currentRoom.name}</span>
          <span className="text-[11px] text-blue-100">{members.length} عضو</span>
        </div>
      )}

      {/* Main content: messages LEFT, sidebar RIGHT */}
      <div className="flex flex-1 overflow-hidden">
        {/* === MESSAGES AREA (LEFT) === */}
        <div className="flex flex-1 flex-col" dir="ltr">
          {/* Messages — light yellow background */}
          <div className="flex-1 overflow-y-auto bg-[#fefce8] px-3 py-2" dir="rtl">
            {!currentRoom ? (
              <div className="flex h-full items-center justify-center text-gray-400 text-sm">اختر غرفة من القائمة</div>
            ) : (
              <>
                {messages.map((msg) => (
                  <MessageRow key={msg.id} message={msg} isOwn={msg.senderId === user?.id} members={members}
                    onNameClick={(target, e) => { setSelectedUser(target); if (hasMod) setActionMenu({ target, position: { x: e.clientX, y: e.clientY } }) }}
                  />
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Typing */}
          {othersTyping.length > 0 && (
            <div className="bg-[#fefce8] px-3 pb-1 text-xs text-gray-400" dir="rtl">
              {othersTyping.length === 1 ? `${othersTyping[0].nickname} يكتب...` : `${othersTyping.length} يكتبون...`}
            </div>
          )}

          {/* Input bar */}
          {currentRoom && (
            <div className="border-t border-gray-300 bg-white px-2 py-2 shrink-0" dir="rtl">
              <div className="flex gap-2">
                <input
                  ref={inputRef} type="text" value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="اكتب رسالتك هنا..."
                  maxLength={500}
                  className="flex-1 rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  dir="auto" autoFocus
                />
                <button onClick={sendMessage} disabled={!input.trim() || sending}
                  className="rounded bg-[#3b82f6] px-4 py-2 text-sm font-bold text-white hover:bg-[#2563eb] disabled:opacity-40">
                  إرسال
                </button>
              </div>

              {/* Mod action bar — only for users with mod permissions */}
              {hasMod && selectedUser && selectedUser.id !== user?.id && (
                <div className="mt-2 flex flex-wrap gap-1 rounded bg-gray-50 p-2 border border-gray-200 animate-fade-in">
                  <span className="text-[11px] text-gray-500 ml-2 self-center">{selectedUser.nickname}:</span>
                  {userPerms.includes('mod.kick.room') && (
                    <button onClick={() => doModAction('kick.room')} className="rounded bg-orange-500 px-2 py-1 text-[10px] text-white hover:bg-orange-600">طرد غرفة</button>
                  )}
                  {userPerms.includes('mod.kick.global') && (
                    <button onClick={() => doModAction('kick.global')} className="rounded bg-orange-700 px-2 py-1 text-[10px] text-white hover:bg-orange-800">طرد شامل</button>
                  )}
                  {userPerms.includes('mod.mute.text.room') && (
                    <button onClick={() => doModAction('mute.text.room')} className="rounded bg-yellow-500 px-2 py-1 text-[10px] text-white hover:bg-yellow-600">كتم نص</button>
                  )}
                  {userPerms.includes('mod.mute.voice.room') && (
                    <button onClick={() => doModAction('mute.voice.room')} className="rounded bg-yellow-600 px-2 py-1 text-[10px] text-white hover:bg-yellow-700">كتم صوت</button>
                  )}
                  {userPerms.includes('mod.mute.both.room') && (
                    <button onClick={() => doModAction('mute.both.room')} className="rounded bg-yellow-700 px-2 py-1 text-[10px] text-white hover:bg-yellow-800">كتم كامل</button>
                  )}
                  {userPerms.includes('mod.ban.room') && (
                    <button onClick={() => doModAction('ban.room')} className="rounded bg-red-500 px-2 py-1 text-[10px] text-white hover:bg-red-600">حظر غرفة</button>
                  )}
                  {userPerms.includes('mod.ban.global') && (
                    <button onClick={() => doModAction('ban.global')} className="rounded bg-red-700 px-2 py-1 text-[10px] text-white hover:bg-red-800">حظر شامل</button>
                  )}
                  {userPerms.includes('mod.ban.ip') && (
                    <button onClick={() => doModAction('ban.ip')} className="rounded bg-red-900 px-2 py-1 text-[10px] text-white hover:bg-red-950">حظر IP</button>
                  )}
                  {userPerms.includes('mod.ban.fingerprint') && (
                    <button onClick={() => doModAction('ban.fingerprint')} className="rounded bg-purple-700 px-2 py-1 text-[10px] text-white hover:bg-purple-800">حظر بصمة</button>
                  )}
                  {userPerms.includes('mod.ban.layered') && (
                    <button onClick={() => doModAction('ban.layered')} className="rounded bg-purple-900 px-2 py-1 text-[10px] text-white hover:bg-purple-950">حظر طبقات</button>
                  )}
                  {userPerms.includes('mod.delete_message') && (
                    <button onClick={() => doModAction('warn')} className="rounded bg-gray-500 px-2 py-1 text-[10px] text-white hover:bg-gray-600">تحذير</button>
                  )}
                  <button onClick={() => setSelectedUser(null)} className="rounded bg-gray-300 px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-400">✕</button>
                </div>
              )}
            </div>
          )}

          {/* Bottom tabs */}
          <div className="flex items-center justify-between bg-[#1e2a3a] px-1 py-1 shrink-0" dir="rtl">
            <div className="flex gap-1">
              <button onClick={() => setBottomTab(bottomTab === 'rooms' ? null : 'rooms')}
                className={`rounded px-3 py-1 text-[11px] ${bottomTab === 'rooms' ? 'bg-[#3b82f6] text-white' : 'text-blue-200/60 hover:text-white'}`}>
                الغرف
              </button>
              {hasAdmin && (
                <button onClick={() => navigate('/admin')} className="rounded px-3 py-1 text-[11px] text-blue-200/60 hover:text-white">
                  الضبط
                </button>
              )}
            </div>
            <span className="flex items-center gap-1 text-[11px] text-blue-200/60">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              {onlineCount}
            </span>
          </div>
        </div>

        {/* === RIGHT SIDEBAR: Rooms + Members === */}
        <div className="hidden w-56 shrink-0 flex-col border-r border-gray-300 bg-[#f3f4f6] sm:flex">
          {/* Rooms section */}
          <div className="bg-[#1e2a3a] px-3 py-1.5 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold text-white">الغرف</span>
            <span className="text-[10px] text-blue-200/60">{rooms.length}</span>
          </div>
          <div className="max-h-[40%] overflow-y-auto border-b border-gray-300">
            {rooms.map(room => {
              const isActive = currentRoom?.id === room.id
              const isFull = room.memberCount >= room.maxMembers
              return (
                <button key={room.id} onClick={() => joinRoom(room.id)} disabled={isFull && !isActive}
                  className={`w-full border-b border-gray-200 px-3 py-2 text-right transition-colors ${isActive ? 'bg-blue-100' : 'hover:bg-gray-100'} disabled:opacity-30`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>{room.name}</span>
                    <span className={`text-[10px] ${isFull ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                      {room.memberCount}/{room.maxMembers}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Members section */}
          {currentRoom && (
            <>
              <div className="bg-[#1e2a3a] px-3 py-1.5 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-white">المتواجدون</span>
                <span className="text-[10px] text-blue-200/60">{members.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {members.map(member => (
                  <div key={member.id}
                    className="flex items-center gap-2 border-b border-gray-200 px-2 py-1.5 cursor-pointer hover:bg-gray-100"
                    onClick={(e) => {
                      setSelectedUser(member)
                      if (member.id !== user?.id && hasMod) setActionMenu({ target: member, position: { x: e.clientX, y: e.clientY } })
                    }}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold text-white" style={{ background: member.avatar }}>
                      {member.nickname.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: member.roleColor || '#374151' }}>
                        {member.roleBadge && <span className="ml-0.5">{member.roleBadge}</span>}
                        {member.nickname}
                        {member.id === user?.id && <span className="text-gray-400 font-normal"> (أنت)</span>}
                      </p>
                      <p className="text-[9px] text-gray-400">{member.statusText || (member.type === 'guest' ? 'غير مسجل' : 'عضو')}</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Room list overlay (mobile bottom tab) */}
      {bottomTab === 'rooms' && (
        <div className="absolute bottom-10 left-0 right-0 z-30 max-h-60 overflow-y-auto border-t border-gray-300 bg-white shadow-lg animate-slide-in sm:hidden" dir="rtl">
          {rooms.map(room => (
            <button key={room.id} onClick={() => joinRoom(room.id)}
              className={`w-full border-b border-gray-100 px-4 py-2.5 text-right ${currentRoom?.id === room.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">{room.name}</span>
                <span className="text-xs text-gray-400">{room.memberCount}/{room.maxMembers}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Action menu */}
      {actionMenu && currentRoom && (
        <UserActionMenu target={actionMenu.target} roomId={currentRoom.id} position={actionMenu.position} onClose={() => setActionMenu(null)} />
      )}
    </div>
  )
}

// IRC-style flat message row — NOT bubbles
function MessageRow({ message, isOwn, members, onNameClick }: {
  message: ChatMessage; isOwn: boolean; members: ChatUser[]
  onNameClick: (target: ChatUser, e: React.MouseEvent) => void
}) {
  if (message.type === 'system') {
    return (
      <div className="py-1 text-center">
        <span className="text-[11px] text-gray-400 bg-yellow-100 rounded px-2 py-0.5">{message.content}</span>
      </div>
    )
  }

  const sender = members.find(m => m.id === message.senderId)
  const color = message.senderRoleColor || sender?.roleColor || '#374151'
  const badge = message.senderRoleBadge || sender?.roleBadge
  const time = new Date(message.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div className="flex items-start gap-2 py-1 animate-fade-in hover:bg-yellow-100/50">
      {/* Avatar */}
      <div
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold text-white cursor-pointer"
        style={{ background: message.senderAvatar }}
        onClick={(e) => { if (!isOwn && sender) onNameClick(sender, e) }}
      >
        {message.senderName.charAt(0)}
      </div>

      {/* Name + message inline */}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold cursor-pointer hover:underline" style={{ color }}
          onClick={(e) => { if (!isOwn && sender) onNameClick(sender, e) }}>
          {badge && <span className="ml-0.5">{badge}</span>}
          {message.senderName}
        </span>
        <span className="text-[9px] text-gray-400 mr-1.5">{time}</span>
        <p className="text-sm text-gray-800 leading-relaxed">{message.content}</p>
      </div>
    </div>
  )
}
