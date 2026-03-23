import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '@/lib/socket'
import { useStore, type ChatMessage, type ChatUser } from '@/hooks/useStore'
import UserProfilePopup from '@/components/UserProfilePopup'

interface ChatColors { normal: string; system: string; admin: string; broadcast: string; private: string }
interface DMThread { id: string; otherUser: { id: string; nickname: string; avatar: string } | null; lastMessage: string; unread: number }

type RightPanel = 'members' | 'rooms' | 'private' | 'settings'

export default function ChatPage() {
  const { user, currentRoom, messages, members, rooms, typingUsers, onlineCount,
    setCurrentRoom, setMessages, setMembers, setRooms, setOnlineCount, setUser, addMessage } = useStore()

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null)
  const [rightPanel, setRightPanel] = useState<RightPanel>('members')
  const [colors, setColors] = useState<ChatColors>({ normal: '#fefce8', system: '#dbeafe', admin: '#fce7f3', broadcast: '#dcfce7', private: '#f3e8ff' })
  const [shortcuts, setShortcuts] = useState<{ code: string; text: string }[]>([])

  // DM state
  const [dmThreads, setDmThreads] = useState<DMThread[]>([])
  const [dmUnread, setDmUnread] = useState(0)
  const [activeDM, setActiveDM] = useState<{ threadId: string; userId: string; nickname: string; avatar: string } | null>(null)
  const [dmMessages, setDmMessages] = useState<any[]>([])
  const [dmInput, setDmInput] = useState('')

  // Room creation
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [newRoom, setNewRoom] = useState({ name: '', description: '', type: 'text', maxMembers: 40, access: 'public' })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const dmEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>()
  const navigate = useNavigate()

  const userPerms = user?.permissions || []
  const hasMod = userPerms.some(p => p.startsWith('mod.'))
  const hasAdmin = userPerms.some(p => p.startsWith('admin.'))
  const canCreateRoom = userPerms.includes('room.create')
  const token = localStorage.getItem('token')

  useEffect(() => { if (!user) navigate('/') }, [user, navigate])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { dmEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [dmMessages])

  // Fetch rooms + chat config
  useEffect(() => {
    fetch('/api/rooms').then(r => r.json()).then(d => { setRooms(d.rooms); setOnlineCount(d.totalOnline) }).catch(() => {})
    fetch('/api/chat-config').then(r => r.json()).then(d => {
      if (d.messageColors) setColors(d.messageColors)
      if (d.shortcuts) setShortcuts(d.shortcuts)
    }).catch(() => {})
  }, [setRooms, setOnlineCount])

  // Fetch DM threads
  const fetchDMThreads = () => {
    if (!token) return
    fetch('/api/dm/threads', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { setDmThreads(d.threads || []); setDmUnread(d.totalUnread || 0) }).catch(() => {})
  }

  useEffect(() => { fetchDMThreads(); const iv = setInterval(fetchDMThreads, 10000); return () => clearInterval(iv) }, [token])

  // Fetch DM messages for active thread
  const fetchDMMessages = (threadId: string) => {
    if (!token) return
    fetch(`/api/dm/threads/${threadId}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setDmMessages(d.messages || [])).catch(() => {})
  }

  // Event listeners
  useEffect(() => {
    const onKicked = () => { showToast('تم طردك من الغرفة'); setCurrentRoom(null); setMessages([]); setMembers([]) }
    const onBanned = (d: any) => { showToast(`تم حظرك: ${d.reason}`); setCurrentRoom(null); setMessages([]); setMembers([]) }
    const onGlobalBanned = () => { socket.disconnect(); navigate('/') }
    const onMuted = (d: any) => showToast(`تم كتمك: ${d.reason}`)
    const onDeleted = (d: any) => useStore.setState(s => ({ messages: s.messages.filter(m => m.id !== d.messageId) }))
    const onBroadcast = (d: any) => showToast(`📢 ${d.from}: ${d.content}`)
    const onDM = (d: any) => {
      setDmUnread(prev => prev + 1)
      if (activeDM?.threadId === d.threadId) setDmMessages(prev => [...prev, d])
      fetchDMThreads()
    }

    socket.on('room:kicked', onKicked); socket.on('room:banned', onBanned)
    socket.on('user:banned', onGlobalBanned); socket.on('room:muted', onMuted)
    socket.on('message:deleted', onDeleted); socket.on('broadcast:global', onBroadcast)
    socket.on('dm:receive', onDM)

    return () => { socket.off('room:kicked'); socket.off('room:banned'); socket.off('user:banned'); socket.off('room:muted'); socket.off('message:deleted'); socket.off('broadcast:global'); socket.off('dm:receive') }
  }, [navigate, setCurrentRoom, setMessages, setMembers, activeDM])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  const joinRoom = (roomId: string) => {
    socket.emit('room:join', { roomId }, (res: any) => {
      if (res.error) return showToast(res.error)
      setCurrentRoom(res.room); setMessages(res.messages); setMembers(res.members)
      localStorage.setItem('lastRoomId', roomId)
      setRightPanel('members')
    })
  }

  const createRoom = () => {
    if (!newRoom.name.trim()) return
    socket.emit('room:create', { name: newRoom.name.trim(), description: newRoom.description, type: newRoom.type }, (res: any) => {
      if (res.error) return showToast(res.error)
      setNewRoom({ name: '', description: '', type: 'text', maxMembers: 40, access: 'public' })
      setShowNewRoom(false)
      showToast(`تم إنشاء: ${res.room.name}`)
    })
  }

  const sendMessage = () => {
    let content = input.trim()
    if (!content || sending) return
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
    if (!token || target.id === user?.id) return
    fetch('/api/dm/threads', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ targetUserId: target.id }) })
      .then(r => r.json()).then(d => {
        setActiveDM({ threadId: d.threadId, userId: target.id, nickname: target.nickname, avatar: target.avatar })
        fetchDMMessages(d.threadId)
        setRightPanel('private')
      }).catch(() => {})
  }

  const sendDM = () => {
    if (!activeDM || !dmInput.trim()) return
    socket.emit('dm:send', { targetUserId: activeDM.userId, content: dmInput.trim() }, (res: any) => {
      if (res.error) return showToast(res.error)
      if (res.message) setDmMessages(prev => [...prev, res.message])
      setDmInput('')
      fetchDMThreads()
    })
  }

  const handleLogout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('lastRoomId')
    socket.disconnect(); setUser(null); setCurrentRoom(null); setMessages([]); setMembers([])
    navigate('/')
  }

  const othersTyping = typingUsers.filter(t => t.userId !== user?.id)
  if (!user) return null

  return (
    <div className="flex h-full flex-col bg-[#e5e7eb]">
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

      {/* Room name bar */}
      {currentRoom && (
        <div className="flex items-center justify-between bg-[#3b82f6] px-3 py-1.5 shrink-0">
          <span className="text-sm font-bold text-white">{currentRoom.name}</span>
          <span className="text-[11px] text-blue-100">{members.length} عضو</span>
        </div>
      )}

      {/* Main: messages LEFT, panel RIGHT */}
      <div className="flex flex-1 overflow-hidden">
        {/* === LEFT: MESSAGES (dir=rtl for Arabic text, messages stack top-down) === */}
        <div className="flex flex-1 flex-col">
          <div className="flex-1 overflow-y-auto" style={{ background: colors.normal }}>
            {!currentRoom ? (
              <div className="flex h-full items-center justify-center text-gray-400 text-sm">اختر غرفة من القائمة</div>
            ) : (
              <div>
                {messages.map((msg, i) => {
                  const bgColor = msg.type === 'system' ? colors.system : i % 2 === 0 ? colors.normal : '#f5f0e0'
                  return (
                    <div key={msg.id} className="flex items-start gap-2 px-3 py-2 border-b border-black/5 animate-fade-in cursor-pointer"
                      style={{ background: bgColor }}
                      onClick={() => {
                        if (msg.senderId !== 'system' && msg.senderId !== user?.id) {
                          const m = members.find(x => x.id === msg.senderId)
                          if (m) setSelectedUser(m)
                        }
                      }} dir="rtl"
                    >
                      {msg.type === 'system' ? (
                        <div className="w-full py-0.5">
                          <span className="text-[11px] text-gray-500">{msg.content}</span>
                        </div>
                      ) : (
                        <>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-xs font-bold text-white" style={{ background: msg.senderAvatar }}>
                            {msg.senderName.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold hover:underline" style={{ color: msg.senderRoleColor || '#1e40af' }}>
                              {msg.senderRoleBadge && <span className="ml-0.5">{msg.senderRoleBadge}</span>}{msg.senderName}
                            </span>
                            <span className="text-[9px] text-gray-400 mr-2">
                              {new Date(msg.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            </span>
                            <p className="text-sm text-gray-800 mt-0.5">{msg.content}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Typing */}
          {othersTyping.length > 0 && <div className="px-3 py-1 text-xs text-gray-400 bg-white/80" dir="rtl">{othersTyping[0].nickname} يكتب...</div>}

          {/* Input */}
          {currentRoom && (
            <div className="border-t border-gray-300 bg-white px-2 py-2 shrink-0" dir="rtl">
              <div className="flex gap-2">
                <input ref={inputRef} value={input} onChange={e => handleTyping(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  placeholder="اكتب رسالتك هنا..." maxLength={500}
                  className="flex-1 rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" dir="auto" autoFocus />
                <button onClick={sendMessage} disabled={!input.trim() || sending}
                  className="rounded bg-[#3b82f6] px-4 py-2 text-sm font-bold text-white hover:bg-[#2563eb] disabled:opacity-40">إرسال</button>
              </div>
            </div>
          )}

          {/* Bottom tab bar */}
          <div className="flex items-center justify-between bg-[#1e2a3a] px-1 py-1 shrink-0" dir="rtl">
            <div className="flex gap-0.5">
              {hasAdmin && <button onClick={() => navigate('/admin')} className="rounded px-2.5 py-1 text-[11px] text-blue-200/60 hover:text-white">الضبط</button>}
              <button onClick={() => setRightPanel(rightPanel === 'rooms' ? 'members' : 'rooms')}
                className={`rounded px-2.5 py-1 text-[11px] ${rightPanel === 'rooms' ? 'bg-[#3b82f6] text-white' : 'text-blue-200/60 hover:text-white'}`}>
                الغرف
              </button>
              <button onClick={() => { setRightPanel('private'); fetchDMThreads() }}
                className={`rounded px-2.5 py-1 text-[11px] ${rightPanel === 'private' ? 'bg-[#3b82f6] text-white' : dmUnread > 0 ? 'text-yellow-300 font-bold' : 'text-blue-200/60 hover:text-white'}`}>
                خاص {dmUnread > 0 && <span className="rounded bg-red-500 px-1 text-[9px] text-white mr-0.5">{dmUnread}</span>}
              </button>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-blue-200/60">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> {onlineCount}
            </span>
          </div>
        </div>

        {/* === RIGHT PANEL === */}
        <div className="hidden w-56 shrink-0 flex-col border-r border-gray-300 bg-[#f3f4f6] sm:flex">
          {/* MEMBERS */}
          {rightPanel === 'members' && (
            <>
              <div className="bg-[#1e2a3a] px-3 py-1.5 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-white">المتواجدون</span>
                <span className="text-[10px] text-blue-200/60">{members.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-2 border-b border-gray-200 px-2 py-1.5 cursor-pointer hover:bg-gray-100"
                    onClick={() => { if (m.id !== user?.id) setSelectedUser(m) }}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: m.avatar }}>{m.nickname.charAt(0)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: m.roleColor || '#374151' }}>
                        {m.roleBadge && <span className="ml-0.5">{m.roleBadge}</span>}{m.nickname}
                        {m.id === user?.id && <span className="text-gray-400 font-normal"> (أنت)</span>}
                      </p>
                      <p className="text-[9px] text-gray-400">{m.statusText || (m.type === 'guest' ? 'غير مسجل' : 'عضو')}</p>
                    </div>
                    <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ROOMS */}
          {rightPanel === 'rooms' && (
            <>
              <div className="bg-[#1e2a3a] px-3 py-1.5 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-white">الغرف</span>
                {canCreateRoom && <button onClick={() => setShowNewRoom(!showNewRoom)} className="text-[10px] text-blue-200 hover:text-white">+ جديدة</button>}
              </div>
              {showNewRoom && (
                <div className="p-2 border-b border-gray-300 bg-white animate-fade-in space-y-1.5">
                  <input value={newRoom.name} onChange={e => setNewRoom({ ...newRoom, name: e.target.value })} placeholder="اسم الغرفة..." className="w-full rounded border border-gray-300 px-2 py-1 text-xs" dir="auto" autoFocus />
                  <input value={newRoom.description} onChange={e => setNewRoom({ ...newRoom, description: e.target.value })} placeholder="وصف (اختياري)..." className="w-full rounded border border-gray-300 px-2 py-1 text-xs" dir="auto" />
                  <div className="flex gap-1">
                    <select value={newRoom.type} onChange={e => setNewRoom({ ...newRoom, type: e.target.value })} className="flex-1 rounded border border-gray-300 px-1 py-1 text-[10px]">
                      <option value="text">نص</option>
                      <option value="voice">صوت</option>
                      <option value="hybrid">نص + صوت</option>
                    </select>
                    <select value={newRoom.access} onChange={e => setNewRoom({ ...newRoom, access: e.target.value })} className="flex-1 rounded border border-gray-300 px-1 py-1 text-[10px]">
                      <option value="public">عامة</option>
                      <option value="restricted">مقيدة</option>
                      <option value="private">خاصة</option>
                    </select>
                  </div>
                  <button onClick={createRoom} className="w-full rounded bg-blue-500 py-1 text-[10px] text-white">إنشاء</button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto">
                {rooms.map(room => {
                  const isActive = currentRoom?.id === room.id
                  const isFull = room.memberCount >= room.maxMembers
                  return (
                    <button key={room.id} onClick={() => joinRoom(room.id)} disabled={isFull && !isActive}
                      className={`w-full border-b border-gray-200 px-3 py-2 text-right transition-colors ${isActive ? 'bg-blue-100' : 'hover:bg-gray-100'} disabled:opacity-30`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className={`text-xs font-bold ${isActive ? 'text-blue-700' : 'text-gray-700'}`}>{room.name}</span>
                          {room.type === 'voice' && <span className="text-[8px] bg-purple-100 text-purple-600 rounded px-1">صوت</span>}
                          {room.type === 'hybrid' && <span className="text-[8px] bg-indigo-100 text-indigo-600 rounded px-1">نص+صوت</span>}
                        </div>
                        <span className={`text-[10px] ${isFull ? 'text-red-500 font-bold' : 'text-gray-400'}`}>{room.memberCount}/{room.maxMembers}</span>
                      </div>
                      {room.description && <p className="text-[9px] text-gray-400 mt-0.5 truncate">{room.description}</p>}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* PRIVATE MESSAGES */}
          {rightPanel === 'private' && (
            <>
              <div className="bg-[#1e2a3a] px-3 py-1.5 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-white">الرسائل الخاصة</span>
                {activeDM && <button onClick={() => setActiveDM(null)} className="text-[10px] text-blue-200 hover:text-white">← القائمة</button>}
              </div>

              {!activeDM ? (
                /* DM Thread list */
                <div className="flex-1 overflow-y-auto">
                  {dmThreads.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">لا توجد محادثات خاصة</div>
                  ) : dmThreads.map(t => (
                    <div key={t.id} className={`flex items-center gap-2 border-b border-gray-200 px-2 py-2 cursor-pointer hover:bg-gray-100 ${t.unread > 0 ? 'bg-blue-50' : ''}`}
                      onClick={() => { setActiveDM({ threadId: t.id, userId: t.otherUser?.id || '', nickname: t.otherUser?.nickname || '', avatar: t.otherUser?.avatar || '' }); fetchDMMessages(t.id) }}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: t.otherUser?.avatar || '#6b7280' }}>
                        {t.otherUser?.nickname?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-700 truncate">{t.otherUser?.nickname}</span>
                          {t.unread > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[9px] text-white">{t.unread}</span>}
                        </div>
                        <p className="text-[10px] text-gray-400 truncate">{t.lastMessage}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Active DM conversation */
                <div className="flex flex-1 flex-col">
                  <div className="bg-gray-100 px-2 py-1.5 border-b border-gray-200 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded text-[9px] font-bold text-white" style={{ background: activeDM.avatar }}>{activeDM.nickname.charAt(0)}</div>
                    <span className="text-xs font-bold text-gray-700">{activeDM.nickname}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 bg-white" style={{ background: colors.private }}>
                    {dmMessages.map((m, i) => (
                      <div key={i} className="mb-1.5">
                        <span className="text-[10px] font-bold" style={{ color: m.senderId === user?.id ? '#059669' : '#1e40af' }}>{m.senderName}: </span>
                        <span className="text-xs text-gray-700">{m.content}</span>
                        <span className="text-[8px] text-gray-400 mr-1">{new Date(m.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                    <div ref={dmEndRef} />
                  </div>
                  <div className="flex gap-1 p-1.5 border-t border-gray-200 bg-white">
                    <input value={dmInput} onChange={e => setDmInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendDM()}
                      placeholder="رسالة خاصة..." className="flex-1 rounded border border-gray-200 px-2 py-1.5 text-[11px]" dir="auto" autoFocus />
                    <button onClick={sendDM} className="rounded bg-blue-500 px-2 py-1.5 text-[10px] text-white">إرسال</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* User profile popup */}
      {selectedUser && selectedUser.id !== user?.id && (
        <UserProfilePopup target={selectedUser} roomId={currentRoom?.id} onClose={() => setSelectedUser(null)} onOpenDM={openDM} />
      )}
    </div>
  )
}
