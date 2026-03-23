import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '@/lib/socket'
import { useStore, type ChatMessage, type ChatUser } from '@/hooks/useStore'
import UserActionMenu from '@/components/UserActionMenu'

interface ChatColors { normal: string; system: string; admin: string; broadcast: string; private: string }
interface DMWindow { userId: string; nickname: string; avatar: string; messages: any[]; minimized: boolean }

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
  const [rightTab, setRightTab] = useState<'members' | 'rooms' | 'settings'>('members')
  const [colors, setColors] = useState<ChatColors>({ normal: '#fefce8', system: '#dbeafe', admin: '#fce7f3', broadcast: '#dcfce7', private: '#f3e8ff' })
  const [shortcuts, setShortcuts] = useState<{ code: string; text: string }[]>([])
  const [dmWindows, setDmWindows] = useState<DMWindow[]>([])
  const [dmInput, setDmInput] = useState<Record<string, string>>({})
  const [newRoomName, setNewRoomName] = useState('')
  const [showNewRoom, setShowNewRoom] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>()
  const navigate = useNavigate()

  const userPerms = user?.permissions || []
  const hasMod = userPerms.some(p => p.startsWith('mod.'))
  const hasAdmin = userPerms.some(p => p.startsWith('admin.'))
  const canCreateRoom = userPerms.includes('room.create')

  useEffect(() => { if (!user) navigate('/') }, [user, navigate])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Fetch rooms + chat config
  useEffect(() => {
    fetch('/api/rooms').then(r => r.json()).then(d => { setRooms(d.rooms); setOnlineCount(d.totalOnline) }).catch(() => {})
    fetch('/api/chat-config').then(r => r.json()).then(d => {
      if (d.messageColors) setColors(d.messageColors)
      if (d.shortcuts) setShortcuts(d.shortcuts)
    }).catch(() => {})
  }, [setRooms, setOnlineCount])

  // Event listeners
  useEffect(() => {
    const onKicked = () => { showToast('تم طردك من الغرفة'); setCurrentRoom(null); setMessages([]); setMembers([]) }
    const onBanned = (d: any) => { showToast(`تم حظرك: ${d.reason}`); setCurrentRoom(null); setMessages([]); setMembers([]) }
    const onGlobalBanned = () => { socket.disconnect(); navigate('/') }
    const onMuted = (d: any) => showToast(`تم كتمك: ${d.reason}`)
    const onDeleted = (d: any) => useStore.setState(s => ({ messages: s.messages.filter(m => m.id !== d.messageId) }))
    const onBroadcast = (d: any) => showToast(`📢 ${d.from}: ${d.content}`)
    const onDM = (d: any) => {
      setDmWindows(prev => {
        const existing = prev.find(w => w.userId === d.senderId)
        if (existing) {
          return prev.map(w => w.userId === d.senderId ? { ...w, messages: [...w.messages, d], minimized: false } : w)
        }
        return [...prev, { userId: d.senderId, nickname: d.senderName, avatar: d.senderAvatar, messages: [d], minimized: false }]
      })
    }

    socket.on('room:kicked', onKicked); socket.on('room:banned', onBanned)
    socket.on('user:banned', onGlobalBanned); socket.on('room:muted', onMuted)
    socket.on('message:deleted', onDeleted); socket.on('broadcast:global', onBroadcast)
    socket.on('dm:receive', onDM); socket.on('dm:sent', onDM)

    return () => {
      socket.off('room:kicked'); socket.off('room:banned'); socket.off('user:banned')
      socket.off('room:muted'); socket.off('message:deleted'); socket.off('broadcast:global')
      socket.off('dm:receive'); socket.off('dm:sent')
    }
  }, [navigate, setCurrentRoom, setMessages, setMembers])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  const joinRoom = (roomId: string) => {
    socket.emit('room:join', { roomId }, (res: any) => {
      if (res.error) return showToast(res.error)
      setCurrentRoom(res.room); setMessages(res.messages); setMembers(res.members)
      setRightTab('members')
    })
  }

  const createRoom = () => {
    const name = newRoomName.trim()
    if (!name) return
    socket.emit('room:create', { name }, (res: any) => {
      if (res.error) return showToast(res.error)
      setNewRoomName(''); setShowNewRoom(false)
      showToast(`تم إنشاء غرفة: ${res.room.name}`)
    })
  }

  const sendMessage = () => {
    let content = input.trim()
    if (!content || sending) return

    // Client-side shortcut preview (server also expands)
    const sc = shortcuts.find(s => s.code === content)
    if (sc) content = sc.text

    setSending(true)
    socket.emit('message:send', { content }, (res: any) => {
      setSending(false)
      if (res.error) return showToast(res.error)
      setInput(''); inputRef.current?.focus()
    })
    socket.emit('typing:stop')
  }

  const handleTyping = (v: string) => {
    setInput(v); socket.emit('typing:start')
    if (typingTimeout.current) clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => socket.emit('typing:stop'), 2000)
  }

  const openDM = (target: ChatUser) => {
    if (target.id === user?.id) return
    setDmWindows(prev => {
      if (prev.find(w => w.userId === target.id)) return prev.map(w => w.userId === target.id ? { ...w, minimized: false } : w)
      return [...prev, { userId: target.id, nickname: target.nickname, avatar: target.avatar, messages: [], minimized: false }]
    })
  }

  const sendDM = (targetUserId: string) => {
    const content = dmInput[targetUserId]?.trim()
    if (!content) return
    socket.emit('dm:send', { targetUserId, content }, (res: any) => {
      if (res.error) return showToast(res.error)
      setDmInput(prev => ({ ...prev, [targetUserId]: '' }))
    })
  }

  const doModAction = (action: string, target?: ChatUser) => {
    const t = target || selectedUser
    if (!t || !currentRoom) return
    const reason = prompt('السبب:') || 'مخالفة'
    socket.emit('mod:action', { action, targetUserId: t.id, roomId: currentRoom.id, reason, duration: 15 }, (res: any) => {
      if (res.error) showToast(res.error); else showToast('تم تنفيذ الإجراء')
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
      {toast && <div className="absolute left-1/2 top-2 z-50 -translate-x-1/2 rounded bg-[#1e2a3a] px-4 py-2 text-sm text-white shadow-lg animate-fade-in">{toast}</div>}

      {/* Top bar */}
      <div className="flex items-center justify-between bg-[#1e2a3a] px-3 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-white">شات</h1>
          <span className="flex items-center gap-1 rounded bg-[#2a3a4e] px-2 py-0.5 text-[11px] text-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> {onlineCount} متصل
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: user.roleColor || '#93c5fd' }}>
            {user.roleBadge && <span className="ml-1">{user.roleBadge}</span>}{user.nickname}
          </span>
          {hasAdmin && <button onClick={() => navigate('/admin')} className="rounded bg-[#2a3a4e] px-2 py-1 text-[10px] text-blue-200 hover:bg-[#3b82f6]">لوحة التحكم</button>}
          <button onClick={handleLogout} className="rounded bg-[#2a3a4e] px-2 py-1 text-[10px] text-blue-200 hover:bg-red-600">خروج</button>
        </div>
      </div>

      {/* Room bar */}
      {currentRoom && (
        <div className="flex items-center justify-between bg-[#3b82f6] px-3 py-1.5 shrink-0">
          <span className="text-sm font-bold text-white">{currentRoom.name}</span>
          <span className="text-[11px] text-blue-100">{members.length} عضو</span>
        </div>
      )}

      {/* Main: messages LEFT, panel RIGHT */}
      <div className="flex flex-1 overflow-hidden">
        {/* === LEFT: MESSAGES === */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto" style={{ background: colors.normal }} dir="rtl">
            {!currentRoom ? (
              <div className="flex h-full items-center justify-center text-gray-400 text-sm">اختر غرفة من القائمة</div>
            ) : (
              <div className="px-1">
                {messages.map((msg, i) => (
                  <div key={msg.id} className="flex items-start gap-2 px-2 py-1.5 border-b border-black/5 animate-fade-in"
                    style={{ background: msg.type === 'system' ? colors.system : i % 2 === 0 ? colors.normal : `${colors.normal}dd` }}
                    onClick={() => {
                      if (msg.senderId !== 'system' && msg.senderId !== user?.id) {
                        const m = members.find(x => x.id === msg.senderId)
                        if (m) setSelectedUser(m)
                      }
                    }}
                  >
                    {msg.type === 'system' ? (
                      <div className="w-full text-center py-0.5">
                        <span className="text-[11px] text-gray-500">{msg.content}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-xs font-bold text-white cursor-pointer" style={{ background: msg.senderAvatar }}>
                          {msg.senderName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold cursor-pointer hover:underline" style={{ color: msg.senderRoleColor || '#1e40af' }}>
                              {msg.senderRoleBadge && <span className="ml-0.5">{msg.senderRoleBadge}</span>}{msg.senderName}
                            </span>
                            <span className="text-[9px] text-gray-400">
                              {new Date(msg.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800">{msg.content}</p>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Typing */}
          {othersTyping.length > 0 && (
            <div className="px-3 py-1 text-xs text-gray-400 bg-white/80" dir="rtl">
              {othersTyping.length === 1 ? `${othersTyping[0].nickname} يكتب...` : `${othersTyping.length} يكتبون...`}
            </div>
          )}

          {/* Input + mod bar */}
          {currentRoom && (
            <div className="border-t border-gray-300 bg-white shrink-0" dir="rtl">
              <div className="flex gap-2 px-2 py-2">
                <input ref={inputRef} value={input} onChange={e => handleTyping(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="اكتب رسالتك هنا..." maxLength={500}
                  className="flex-1 rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" dir="auto" autoFocus
                />
                <button onClick={sendMessage} disabled={!input.trim() || sending}
                  className="rounded bg-[#3b82f6] px-4 py-2 text-sm font-bold text-white hover:bg-[#2563eb] disabled:opacity-40">إرسال</button>
              </div>

              {/* Mod bar */}
              {hasMod && selectedUser && selectedUser.id !== user?.id && (
                <div className="flex flex-wrap gap-1 px-2 pb-2 animate-fade-in">
                  <span className="text-[11px] text-gray-500 self-center ml-2">{selectedUser.nickname}:</span>
                  {userPerms.includes('mod.kick.room') && <button onClick={() => doModAction('kick.room')} className="rounded bg-orange-500 px-2 py-0.5 text-[10px] text-white">طرد</button>}
                  {userPerms.includes('mod.mute.text.room') && <button onClick={() => doModAction('mute.text.room')} className="rounded bg-yellow-500 px-2 py-0.5 text-[10px] text-white">كتم</button>}
                  {userPerms.includes('mod.ban.room') && <button onClick={() => doModAction('ban.room')} className="rounded bg-red-500 px-2 py-0.5 text-[10px] text-white">حظر غرفة</button>}
                  {userPerms.includes('mod.ban.global') && <button onClick={() => doModAction('ban.global')} className="rounded bg-red-700 px-2 py-0.5 text-[10px] text-white">حظر شامل</button>}
                  {userPerms.includes('mod.ban.ip') && <button onClick={() => doModAction('ban.ip')} className="rounded bg-red-900 px-2 py-0.5 text-[10px] text-white">حظر IP</button>}
                  {userPerms.includes('mod.ban.layered') && <button onClick={() => doModAction('ban.layered')} className="rounded bg-purple-800 px-2 py-0.5 text-[10px] text-white">حظر طبقات</button>}
                  {userPerms.includes('mod.delete_message') && <button onClick={() => doModAction('warn')} className="rounded bg-gray-500 px-2 py-0.5 text-[10px] text-white">تحذير</button>}
                  <button onClick={() => openDM(selectedUser)} className="rounded bg-blue-500 px-2 py-0.5 text-[10px] text-white">خاص</button>
                  <button onClick={() => setSelectedUser(null)} className="rounded bg-gray-300 px-2 py-0.5 text-[10px] text-gray-600">✕</button>
                </div>
              )}
            </div>
          )}

          {/* Bottom tab bar */}
          <div className="flex items-center justify-between bg-[#1e2a3a] px-1 py-1 shrink-0" dir="rtl">
            <div className="flex gap-0.5">
              {hasAdmin && <button onClick={() => navigate('/admin')} className={`rounded px-2.5 py-1 text-[11px] text-blue-200/60 hover:text-white`}>الضبط</button>}
              <button onClick={() => setRightTab(rightTab === 'rooms' ? 'members' : 'rooms')} className={`rounded px-2.5 py-1 text-[11px] ${rightTab === 'rooms' ? 'bg-[#3b82f6] text-white' : 'text-blue-200/60 hover:text-white'}`}>الغرف</button>
              <button onClick={() => { /* TODO: DM list tab */ }} className="rounded px-2.5 py-1 text-[11px] text-blue-200/60 hover:text-white">
                خاص {dmWindows.length > 0 && <span className="rounded bg-red-500 px-1 text-[9px] text-white mr-0.5">{dmWindows.length}</span>}
              </button>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-blue-200/60">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> {onlineCount}
            </span>
          </div>
        </div>

        {/* === RIGHT PANEL (changes based on tab) === */}
        <div className="hidden w-56 shrink-0 flex-col border-r border-gray-300 bg-[#f3f4f6] sm:flex">
          {rightTab === 'rooms' ? (
            <>
              <div className="bg-[#1e2a3a] px-3 py-1.5 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-white">الغرف</span>
                {canCreateRoom && <button onClick={() => setShowNewRoom(!showNewRoom)} className="text-[10px] text-blue-200 hover:text-white">+ جديدة</button>}
              </div>
              {showNewRoom && (
                <div className="p-2 border-b border-gray-300 bg-white animate-fade-in">
                  <input value={newRoomName} onChange={e => setNewRoomName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createRoom()}
                    placeholder="اسم الغرفة..." className="w-full rounded border border-gray-300 px-2 py-1 text-xs mb-1" dir="auto" autoFocus />
                  <button onClick={createRoom} className="w-full rounded bg-blue-500 py-1 text-[10px] text-white">إنشاء</button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {rooms.map(room => {
                  const isActive = currentRoom?.id === room.id
                  return (
                    <button key={room.id} onClick={() => joinRoom(room.id)}
                      className={`w-full border-b border-gray-200 px-3 py-2 text-right transition-colors ${isActive ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>{room.name}</span>
                        <span className="text-[10px] text-gray-400">{room.memberCount}/{room.maxMembers}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <div className="bg-[#1e2a3a] px-3 py-1.5 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-white">المتواجدون</span>
                <span className="text-[10px] text-blue-200/60">{members.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {members.map(member => (
                  <div key={member.id}
                    className="flex items-center gap-2 border-b border-gray-200 px-2 py-1.5 cursor-pointer hover:bg-gray-100"
                    onClick={() => { if (member.id !== user?.id) setSelectedUser(member) }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: member.avatar }}>
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

      {/* DM Popup Windows */}
      {dmWindows.filter(w => !w.minimized).map((dm, i) => (
        <div key={dm.userId} className="fixed z-40 animate-slide-in"
          style={{ bottom: 50, left: 16 + i * 280, width: 260 }} dir="rtl">
          <div className="rounded-t-lg border border-gray-300 bg-white shadow-xl overflow-hidden">
            {/* DM header */}
            <div className="flex items-center justify-between bg-[#1e2a3a] px-3 py-1.5">
              <span className="text-xs font-bold text-white">{dm.nickname}</span>
              <div className="flex gap-1">
                <button onClick={() => setDmWindows(prev => prev.map(w => w.userId === dm.userId ? { ...w, minimized: true } : w))} className="text-[10px] text-blue-200">ー</button>
                <button onClick={() => setDmWindows(prev => prev.filter(w => w.userId !== dm.userId))} className="text-[10px] text-red-300">✕</button>
              </div>
            </div>
            {/* DM messages */}
            <div className="h-40 overflow-y-auto p-2" style={{ background: colors.private }}>
              {dm.messages.map((m, j) => (
                <div key={j} className="mb-1">
                  <span className="text-[10px] font-bold" style={{ color: m.senderRoleColor || '#1e40af' }}>{m.senderName}: </span>
                  <span className="text-xs text-gray-700">{m.content}</span>
                </div>
              ))}
            </div>
            {/* DM input */}
            <div className="flex gap-1 p-1.5 border-t border-gray-200">
              <input value={dmInput[dm.userId] || ''} onChange={e => setDmInput(prev => ({ ...prev, [dm.userId]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && sendDM(dm.userId)}
                placeholder="رسالة خاصة..." className="flex-1 rounded border border-gray-200 px-2 py-1 text-[11px]" dir="auto" />
              <button onClick={() => sendDM(dm.userId)} className="rounded bg-blue-500 px-2 py-1 text-[10px] text-white">إرسال</button>
            </div>
          </div>
        </div>
      ))}

      {/* Minimized DMs */}
      {dmWindows.filter(w => w.minimized).length > 0 && (
        <div className="fixed bottom-1 left-1 z-30 flex gap-1" dir="rtl">
          {dmWindows.filter(w => w.minimized).map(dm => (
            <button key={dm.userId} onClick={() => setDmWindows(prev => prev.map(w => w.userId === dm.userId ? { ...w, minimized: false } : w))}
              className="rounded bg-[#1e2a3a] px-2 py-1 text-[10px] text-blue-200 shadow">
              {dm.nickname}
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
