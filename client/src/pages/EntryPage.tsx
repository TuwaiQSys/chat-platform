import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { socket } from '@/lib/socket'
import { collectSignals } from '@/lib/fingerprint'
import { useStore } from '@/hooks/useStore'

export default function EntryPage() {
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const setUser = useStore((s) => s.setUser)
  const navigate = useNavigate()

  const handleJoin = () => {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed.length < 2) {
      setError('الاسم يجب أن يكون حرفين على الأقل')
      return
    }
    if (trimmed.length > 20) {
      setError('الاسم يجب أن لا يتجاوز 20 حرف')
      return
    }

    setLoading(true)
    setError('')

    if (!socket.connected) socket.connect()

    const signals = collectSignals()
    socket.emit('guest:join', { nickname: trimmed, signals }, (res: any) => {
      setLoading(false)
      if (res.error) {
        setError(res.error)
        return
      }
      setUser(res.user)
      navigate('/lobby')
    })
  }

  return (
    <div className="flex h-full items-center justify-center px-4">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-1/2 top-1/4 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-indigo-600/5 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-purple-600/5 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm animate-fade-in">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600/10 ring-1 ring-indigo-500/20">
            <MessageCircle className="h-8 w-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">شات</h1>
          <p className="text-sm text-white/40">ادخل اسمك المستعار وابدأ الدردشة</p>
        </div>

        {/* Form */}
        <div className="glass rounded-2xl p-6 glow-subtle">
          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value)
                  setError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="اكتب الاسم المستعار..."
                maxLength={20}
                className="input-dark text-center text-lg"
                autoFocus
                dir="auto"
              />
              {error && (
                <p className="mt-2 text-center text-sm text-red-400 animate-fade-in">{error}</p>
              )}
            </div>

            <button
              onClick={handleJoin}
              disabled={loading || !nickname.trim()}
              className="btn-primary w-full text-lg"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  جاري الدخول...
                </span>
              ) : (
                'دخول'
              )}
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animation: 'pulse-dot 2s infinite' }} />
            <span>دخول كزائر • بدون تسجيل</span>
          </div>
        </div>
      </div>
    </div>
  )
}
