import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '@/lib/socket'
import { collectSignals } from '@/lib/fingerprint'
import { useStore } from '@/hooks/useStore'

type Tab = 'guest' | 'login' | 'register'

export default function EntryPage() {
  const [tab, setTab] = useState<Tab>('guest')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [hiddenLogin, setHiddenLogin] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<any[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  const { setUser, setCurrentRoom, setMessages, setMembers } = useStore()
  const navigate = useNavigate()

  // Fetch online count
  useEffect(() => {
    fetch('/api/rooms').then(r => r.json()).then(d => setOnlineCount(d.totalOnline)).catch(() => {})

    // Connect temporarily to get online list
    if (!socket.connected) socket.connect()
    socket.emit('users:list', null, (users: any) => { if (Array.isArray(users)) setOnlineUsers(users) })
    socket.on('users:count', (c: number) => setOnlineCount(c))

    return () => { socket.off('users:count') }
  }, [])

  const joinGeneralRoom = (sock: typeof socket) => {
    fetch('/api/rooms').then(r => r.json()).then(data => {
      const room = data.rooms?.[0]
      if (!room) return navigate('/chat')
      sock.emit('room:join', { roomId: room.id }, (res: any) => {
        if (res.error) return navigate('/chat')
        setCurrentRoom(res.room)
        localStorage.setItem('lastRoomId', room.id)
        setMessages(res.messages)
        setMembers(res.members)
        navigate('/chat')
      })
    }).catch(() => navigate('/chat'))
  }

  const handleGuestJoin = () => {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed.length < 2) return setError('الاسم يجب أن يكون حرفين على الأقل')

    setLoading(true); setError('')
    if (!socket.connected) socket.connect()
    const signals = collectSignals()

    socket.emit('guest:join', { nickname: trimmed, signals }, (res: any) => {
      if (res.error) { setLoading(false); return setError(res.error) }
      // Save session token for guest restore on refresh
      if (res.sessionToken) localStorage.setItem('sessionToken', res.sessionToken)
      setUser(res.user)
      joinGeneralRoom(socket)
    })
  }

  const handleAuth = async () => {
    if (tab === 'register' && (!nickname.trim() || nickname.length < 2)) return setError('الاسم مطلوب')
    if (!email) return setError('البريد أو اسم المستخدم مطلوب')
    if (!password || password.length < 6) return setError('كلمة المرور 6 أحرف على الأقل')

    setLoading(true); setError('')
    try {
      const endpoint = tab === 'register' ? '/api/auth/register' : '/api/auth/login'
      const body = tab === 'register'
        ? { nickname: nickname.trim(), email, password }
        : { identifier: email, password }

      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (data.error) { setLoading(false); return setError(data.error) }

      localStorage.setItem('token', data.token)
      if (!socket.connected) socket.connect()

      socket.emit('auth:join', { token: data.token, hidden: hiddenLogin }, (socketRes: any) => {
        if (socketRes.error) { setLoading(false); return setError(socketRes.error) }
        if (data.user.isAdmin) {
          navigate('/admin', { replace: true })
          setTimeout(() => setUser(socketRes.user), 0)
        } else {
          setUser(socketRes.user)
          joinGeneralRoom(socket)
        }
      })
    } catch { setLoading(false); setError('خطأ في الاتصال') }
  }

  const handleSubmit = () => { tab === 'guest' ? handleGuestJoin() : handleAuth() }

  return (
    <div className="flex h-full flex-col bg-[#e5e7eb]">
      {/* Dark blue header */}
      <div className="bg-[#1e2a3a] px-4 py-3 text-center">
        <h1 className="text-xl font-bold text-white">شات</h1>
        <p className="text-[11px] text-blue-200/50 mt-0.5">أكبر تجمع عربي</p>
      </div>

      {/* Tab navigation */}
      <div className="flex bg-[#2a3a4e] text-sm">
        {[
          { key: 'guest' as Tab, label: 'دخول الزوار' },
          { key: 'login' as Tab, label: 'دخول الأعضاء' },
          { key: 'register' as Tab, label: 'تسجيل عضوية' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setError('') }}
            className={`flex-1 py-2 text-center transition-colors ${
              tab === t.key ? 'bg-[#3b82f6] text-white font-bold' : 'text-blue-200/60 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Form area */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="mx-auto max-w-md space-y-2">
          {tab === 'guest' && (
            <input
              value={nickname} onChange={(e) => { setNickname(e.target.value); setError('') }}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="اكتب الاسم المستعار"
              maxLength={20}
              className="w-full rounded border border-gray-300 px-3 py-2.5 text-center text-sm focus:border-blue-500 focus:outline-none"
              autoFocus dir="auto"
            />
          )}

          {tab === 'register' && (
            <input
              value={nickname} onChange={(e) => { setNickname(e.target.value); setError('') }}
              placeholder="الاسم المستعار" maxLength={20}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              dir="auto" autoFocus
            />
          )}

          {(tab === 'login' || tab === 'register') && (
            <>
              <input
                value={email} onChange={(e) => { setEmail(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder={tab === 'login' ? 'البريد أو اسم المستخدم' : 'البريد الإلكتروني'}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                dir="ltr" autoFocus={tab === 'login'}
              />
              <input
                type="password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="كلمة المرور"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                dir="ltr"
              />
              {tab === 'login' && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={hiddenLogin} onChange={e => setHiddenLogin(e.target.checked)} className="accent-blue-500" />
                  <span className="text-xs text-gray-500">دخول مخفي (لا يراك أحد)</span>
                </label>
              )}
            </>
          )}

          {error && <p className="text-center text-xs text-red-600">{error}</p>}

          <button
            onClick={handleSubmit} disabled={loading}
            className="w-full rounded bg-[#3b82f6] py-2.5 text-sm font-bold text-white hover:bg-[#2563eb] disabled:opacity-50"
          >
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </div>
      </div>

      {/* Online status bar */}
      <div className="flex items-center justify-between bg-[#1e2a3a] px-4 py-1.5">
        <span className="text-xs font-bold text-white">متصل</span>
        <span className="flex items-center gap-1.5 text-xs text-blue-200">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          {onlineCount}
        </span>
      </div>

      {/* Online user list */}
      <div className="flex-1 overflow-y-auto bg-[#f8f8f8]">
        {onlineUsers.length > 0 ? onlineUsers.map((u, i) => (
          <div key={u.id || i} className="flex items-center gap-3 border-b border-gray-200 px-4 py-2.5 hover:bg-gray-100 animate-fade-in" style={{ animationDelay: `${i * 30}ms` }}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-sm font-bold text-white" style={{ background: u.avatar }}>
              {u.nickname?.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate" style={{ color: u.roleColor || '#1a202c' }}>
                {u.roleBadge && <span className="ml-1">{u.roleBadge}</span>}
                {u.nickname}
              </p>
              <p className="text-[11px] text-gray-400">{u.type === 'guest' ? '(غير مسجل)' : u.type === 'staff' ? '(طاقم)' : '(عضو)'}</p>
            </div>
            <span className="h-2.5 w-2.5 rounded-full bg-green-500 shrink-0" />
          </div>
        )) : (
          <div className="py-8 text-center text-sm text-gray-400">لا يوجد متصلين حاليًا</div>
        )}
      </div>
    </div>
  )
}
