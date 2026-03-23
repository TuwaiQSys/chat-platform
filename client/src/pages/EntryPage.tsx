import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, User, Shield } from 'lucide-react'
import { socket } from '@/lib/socket'
import { collectSignals } from '@/lib/fingerprint'
import { useStore } from '@/hooks/useStore'

type LoginMode = 'guest' | 'member' | 'admin'

export default function EntryPage() {
  const [mode, setMode] = useState<LoginMode>('guest')
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setUser = useStore((s) => s.setUser)
  const navigate = useNavigate()

  const handleGuestJoin = () => {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed.length < 2) return setError('الاسم يجب أن يكون حرفين على الأقل')
    if (trimmed.length > 20) return setError('الاسم يجب أن لا يتجاوز 20 حرف')

    setLoading(true)
    setError('')
    if (!socket.connected) socket.connect()

    const signals = collectSignals()
    socket.emit('guest:join', { nickname: trimmed, signals }, (res: any) => {
      setLoading(false)
      if (res.error) return setError(res.error)
      setUser(res.user)
      navigate('/lobby')
    })
  }

  const handleAuthSubmit = async () => {
    if (!email || !password) return setError('البريد وكلمة المرور مطلوبان')
    if (isRegister && (!nickname.trim() || nickname.trim().length < 2)) return setError('الاسم مطلوب')
    if (password.length < 6) return setError('كلمة المرور 6 أحرف على الأقل')

    setLoading(true)
    setError('')

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login'
      const body = isRegister
        ? { nickname: nickname.trim(), email, password }
        : { email, password }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.error) {
        setLoading(false)
        return setError(data.error)
      }

      // Store token
      localStorage.setItem('token', data.token)

      // Connect socket with token
      if (!socket.connected) socket.connect()

      socket.emit('auth:join', { token: data.token }, (socketRes: any) => {
        setLoading(false)
        if (socketRes.error) return setError(socketRes.error)

        setUser(socketRes.user)

        // Route based on user type
        if (data.user.type === 'admin' && mode === 'admin') {
          navigate('/admin')
        } else {
          navigate('/lobby')
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

  const tabs: { key: LoginMode; label: string; icon: typeof MessageCircle }[] = [
    { key: 'guest', label: 'زائر', icon: MessageCircle },
    { key: 'member', label: 'عضو', icon: User },
    { key: 'admin', label: 'مسؤول', icon: Shield },
  ]

  return (
    <div className="flex h-full items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-1/4 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-indigo-600/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-purple-600/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/10 ring-1 ring-indigo-500/20">
            <MessageCircle className="h-7 w-7 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">شات</h1>
        </div>

        {/* Login mode tabs */}
        <div className="mb-4 flex gap-1 rounded-xl bg-white/[0.03] p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                onClick={() => { setMode(tab.key); setError(''); setIsRegister(false) }}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
                  mode === tab.key
                    ? 'bg-indigo-600/20 text-indigo-300'
                    : 'text-white/30 hover:text-white/50'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Form */}
        <div className="glass rounded-2xl p-5 glow-subtle">
          <div className="space-y-3">
            {/* Guest: nickname only */}
            {mode === 'guest' && (
              <input
                type="text"
                value={nickname}
                onChange={(e) => { setNickname(e.target.value); setError('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="اكتب الاسم المستعار..."
                maxLength={20}
                className="input-dark text-center"
                autoFocus
                dir="auto"
              />
            )}

            {/* Member/Admin: email + password */}
            {mode !== 'guest' && (
              <>
                {isRegister && (
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => { setNickname(e.target.value); setError('') }}
                    placeholder="الاسم المستعار..."
                    maxLength={20}
                    className="input-dark"
                    autoFocus
                    dir="auto"
                  />
                )}
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="البريد الإلكتروني..."
                  className="input-dark"
                  autoFocus={!isRegister}
                  dir="ltr"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  placeholder="كلمة المرور..."
                  className="input-dark"
                  dir="ltr"
                />
              </>
            )}

            {error && (
              <p className="text-center text-sm text-red-400 animate-fade-in">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  جاري الدخول...
                </span>
              ) : mode === 'guest' ? (
                'دخول كزائر'
              ) : isRegister ? (
                'تسجيل'
              ) : (
                'دخول'
              )}
            </button>

            {/* Toggle register/login for member mode */}
            {mode === 'member' && (
              <button
                onClick={() => { setIsRegister(!isRegister); setError('') }}
                className="w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors"
              >
                {isRegister ? 'لديك حساب؟ سجل دخول' : 'ليس لديك حساب؟ سجل الآن'}
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-white/15">
            {mode === 'guest' && <span>دخول بدون تسجيل</span>}
            {mode === 'member' && <span>تسجيل بالبريد الإلكتروني</span>}
            {mode === 'admin' && <span>لوحة المسؤول</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
