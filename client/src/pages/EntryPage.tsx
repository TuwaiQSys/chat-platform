import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '@/lib/socket'
import { collectSignals } from '@/lib/fingerprint'
import { useStore } from '@/hooks/useStore'

export default function EntryPage() {
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'guest' | 'login'>('guest')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setUser = useStore((s) => s.setUser)
  const setCurrentRoom = useStore((s) => s.setCurrentRoom)
  const setMessages = useStore((s) => s.setMessages)
  const setMembers = useStore((s) => s.setMembers)
  const navigate = useNavigate()

  const joinGeneralRoom = (sock: typeof socket) => {
    // Fetch rooms and join the first general room
    fetch('/api/rooms')
      .then((r) => r.json())
      .then((data) => {
        const generalRoom = data.rooms?.[0]
        if (!generalRoom) return navigate('/chat')

        sock.emit('room:join', { roomId: generalRoom.id }, (res: any) => {
          if (res.error) return navigate('/chat')
          setCurrentRoom(res.room)
          setMessages(res.messages)
          setMembers(res.members)
          navigate('/chat')
        })
      })
      .catch(() => navigate('/chat'))
  }

  const handleGuestJoin = () => {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed.length < 2) return setError('الاسم يجب أن يكون حرفين على الأقل')

    setLoading(true)
    setError('')
    if (!socket.connected) socket.connect()

    const signals = collectSignals()
    socket.emit('guest:join', { nickname: trimmed, signals }, (res: any) => {
      if (res.error) { setLoading(false); return setError(res.error) }
      setUser(res.user)
      joinGeneralRoom(socket)
    })
  }

  const handleAuthSubmit = async () => {
    if (!email || !password) return setError('البريد وكلمة المرور مطلوبان')
    if (isRegister && (!nickname.trim() || nickname.trim().length < 2)) return setError('الاسم مطلوب')

    setLoading(true)
    setError('')

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
      const body = isRegister ? { nickname: nickname.trim(), email, password } : { email, password }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) { setLoading(false); return setError(data.error) }

      localStorage.setItem('token', data.token)
      if (!socket.connected) socket.connect()

      socket.emit('auth:join', { token: data.token }, (socketRes: any) => {
        if (socketRes.error) { setLoading(false); return setError(socketRes.error) }
        setUser(socketRes.user)

        if (data.user.type === 'admin') {
          navigate('/admin')
        } else {
          joinGeneralRoom(socket)
        }
      })
    } catch {
      setLoading(false)
      setError('خطأ في الاتصال')
    }
  }

  const handleSubmit = () => {
    if (mode === 'guest') handleGuestJoin()
    else handleAuthSubmit()
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="rounded-t-lg bg-gradient-to-l from-amber-700 to-amber-800 px-4 py-3 text-center">
          <h1 className="text-2xl font-bold text-white">شات</h1>
        </div>

        {/* Body */}
        <div className="bg-[#f5f0e8] px-6 py-5">
          {/* Tabs */}
          <div className="mb-4 flex border-b border-amber-200">
            <button
              onClick={() => { setMode('guest'); setError('') }}
              className={`flex-1 pb-2 text-sm font-semibold transition-colors ${
                mode === 'guest' ? 'border-b-2 border-amber-600 text-amber-800' : 'text-gray-400'
              }`}
            >
              دخول الزوار
            </button>
            <button
              onClick={() => { setMode('login'); setError('') }}
              className={`flex-1 pb-2 text-sm font-semibold transition-colors ${
                mode === 'login' ? 'border-b-2 border-amber-600 text-amber-800' : 'text-gray-400'
              }`}
            >
              دخول الأعضاء
            </button>
          </div>

          <div className="space-y-3">
            {mode === 'guest' ? (
              <>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => { setNickname(e.target.value); setError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="اكتب الاسم المستعار"
                  maxLength={20}
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2.5 text-center text-sm focus:border-amber-500 focus:outline-none"
                  autoFocus
                  dir="auto"
                />
              </>
            ) : (
              <>
                {isRegister && (
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => { setNickname(e.target.value); setError('') }}
                    placeholder="الاسم المستعار"
                    maxLength={20}
                    className="w-full rounded border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                    dir="auto"
                    autoFocus
                  />
                )}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="البريد الإلكتروني"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                  dir="ltr"
                  autoFocus={!isRegister}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="كلمة المرور"
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-amber-500 focus:outline-none"
                  dir="ltr"
                />
              </>
            )}

            {error && <p className="text-center text-xs text-red-600">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded bg-amber-700 py-2.5 text-sm font-bold text-white hover:bg-amber-800 transition-colors disabled:opacity-50"
            >
              {loading ? 'جاري الدخول...' : 'دخول'}
            </button>

            {mode === 'login' && (
              <button
                onClick={() => { setIsRegister(!isRegister); setError('') }}
                className="w-full text-center text-xs text-amber-700 hover:underline"
              >
                {isRegister ? 'لديك حساب؟ سجل دخول' : 'تسجيل عضوية جديدة'}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="rounded-b-lg bg-[#e8e0d0] px-4 py-2 text-center text-[11px] text-gray-500">
          دخول كزائر بدون تسجيل • تسجيل العضوية للمزايا
        </div>
      </div>
    </div>
  )
}
