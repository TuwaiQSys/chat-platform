import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { socket } from '@/lib/socket'
import { useStore, type ChatUser } from '@/hooks/useStore'

interface Props {
  target: ChatUser
  roomId?: string
  onClose: () => void
  onOpenDM: (target: ChatUser) => void
}

interface ModCategory {
  label: string
  actions: { key: string; label: string; color: string; needsDuration?: boolean; needsScope?: boolean }[]
}

const MOD_CATEGORIES: ModCategory[] = [
  {
    label: 'إجراءات المستخدم',
    actions: [
      { key: 'kick.room', label: 'طرد من الغرفة', color: 'bg-orange-500' },
      { key: 'kick.global', label: 'طرد من الشات', color: 'bg-orange-700' },
      { key: 'warn', label: 'تحذير', color: 'bg-yellow-600' },
    ],
  },
  {
    label: 'كتم النص',
    actions: [
      { key: 'mute.text.room', label: 'كتم نص (غرفة)', color: 'bg-amber-500', needsDuration: true },
      { key: 'mute.text.global', label: 'كتم نص (شامل)', color: 'bg-amber-700', needsDuration: true },
    ],
  },
  {
    label: 'كتم الصوت',
    actions: [
      { key: 'mute.voice.room', label: 'كتم صوت (غرفة)', color: 'bg-yellow-500', needsDuration: true },
      { key: 'mute.voice.global', label: 'كتم صوت (شامل)', color: 'bg-yellow-700', needsDuration: true },
      { key: 'mute.both.room', label: 'كتم كامل (غرفة)', color: 'bg-yellow-800', needsDuration: true },
    ],
  },
  {
    label: 'حظر',
    actions: [
      { key: 'ban.room', label: 'حظر من الغرفة', color: 'bg-red-500', needsDuration: true },
      { key: 'ban.global', label: 'حظر شامل', color: 'bg-red-700', needsDuration: true },
    ],
  },
  {
    label: 'حظر متقدم',
    actions: [
      { key: 'ban.ip', label: 'حظر IP', color: 'bg-red-800' },
      { key: 'ban.fingerprint', label: 'حظر بصمة الجهاز', color: 'bg-purple-700' },
      { key: 'ban.layered', label: 'حظر طبقات (IP + بصمة)', color: 'bg-purple-900' },
    ],
  },
  {
    label: 'الرؤية',
    actions: [
      { key: 'visibility.hidden', label: 'إخفاء المستخدم', color: 'bg-gray-600' },
      { key: 'visibility.royal_hidden', label: 'إخفاء ملكي', color: 'bg-gray-800' },
      { key: 'visibility.visible', label: 'إظهار المستخدم', color: 'bg-green-600' },
    ],
  },
]

const DURATION_OPTIONS = [
  { label: '5 دقائق', value: 5 },
  { label: '15 دقيقة', value: 15 },
  { label: 'ساعة', value: 60 },
  { label: 'يوم', value: 1440 },
  { label: 'دائم', value: 0 },
]

export default function UserProfilePopup({ target, roomId, onClose, onOpenDM }: Props) {
  const user = useStore((s) => s.user)
  const [availablePerms, setAvailablePerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState(15)
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const userPerms = user?.permissions || []
  const hasMod = userPerms.some(p => p.startsWith('mod.'))

  useEffect(() => {
    if (!hasMod) { setLoading(false); return }
    socket.emit('mod:check-permissions', { targetUserId: target.id }, (res: any) => {
      setAvailablePerms(res.actions || [])
      setLoading(false)
    })
  }, [target.id, hasMod])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const executeAction = () => {
    if (!activeAction || executing) return

    // Visibility actions use a different endpoint
    if (activeAction.startsWith('visibility.')) {
      const vis = activeAction.replace('visibility.', '')
      const token = localStorage.getItem('token')
      fetch(`/api/admin/users/${target.id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ visibility: vis }),
      }).then(() => { setResult('تم'); setTimeout(onClose, 1000) })
      return
    }

    setExecuting(true)
    socket.emit('mod:action', {
      action: activeAction,
      targetUserId: target.id,
      roomId,
      reason: reason || 'مخالفة',
      duration: duration || undefined,
    }, (res: any) => {
      setExecuting(false)
      if (res.error) return setResult(res.error)
      setResult('تم تنفيذ الإجراء')
      setTimeout(onClose, 1500)
    })
  }

  if (target.id === user?.id) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div ref={ref} className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-80 max-h-[80vh] overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-2xl animate-fade-in" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#1e2a3a] px-3 py-2 rounded-t-lg">
          <span className="text-sm font-bold text-white">{target.nickname}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        {/* Profile card */}
        <div className="p-4 text-center border-b border-gray-200">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg text-2xl font-bold text-white mb-2" style={{ background: target.avatar }}>
            {target.nickname.charAt(0)}
          </div>
          <h3 className="text-base font-bold" style={{ color: target.roleColor || '#1a202c' }}>
            {target.roleBadge && <span className="ml-1">{target.roleBadge}</span>}
            {target.nickname}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {target.type === 'guest' ? '(غير مسجل)' : target.type === 'staff' ? '(طاقم)' : '(عضو)'}
          </p>
          {target.statusText && <p className="text-xs text-gray-500 mt-1">{target.statusText}</p>}
          {target.lastIp && <p className="text-[10px] text-gray-400 mt-1 font-mono" dir="ltr">IP: {target.lastIp}</p>}
        </div>

        {/* Quick actions */}
        <div className="flex border-b border-gray-200">
          <button onClick={() => { onOpenDM(target); onClose() }} className="flex-1 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50 border-l border-gray-200">
            محادثة خاصة
          </button>
          <button onClick={() => { setActiveAction('warn'); }} className="flex-1 py-2.5 text-xs font-bold text-yellow-600 hover:bg-yellow-50 border-l border-gray-200">
            تنبيه
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-50">
            تجاهل
          </button>
        </div>

        {/* Mod actions (only for users with mod permissions) */}
        {hasMod && !loading && (
          <div className="p-3">
            {activeAction ? (
              /* Action form */
              <div className="space-y-2 animate-fade-in">
                <p className="text-xs text-gray-500 font-bold">
                  {MOD_CATEGORIES.flatMap(c => c.actions).find(a => a.key === activeAction)?.label || activeAction}
                </p>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="السبب..."
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none" dir="auto" autoFocus />

                {MOD_CATEGORIES.flatMap(c => c.actions).find(a => a.key === activeAction)?.needsDuration && (
                  <div className="flex flex-wrap gap-1">
                    {DURATION_OPTIONS.map(d => (
                      <button key={d.value} onClick={() => setDuration(d.value)}
                        className={`rounded px-2 py-0.5 text-[10px] ${duration === d.value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}

                {result && <p className={`text-xs ${result.includes('تم') ? 'text-green-600' : 'text-red-600'}`}>{result}</p>}

                <div className="flex gap-2">
                  <button onClick={() => { setActiveAction(null); setResult(null) }} className="flex-1 rounded bg-gray-100 py-1.5 text-xs text-gray-500">رجوع</button>
                  <button onClick={executeAction} disabled={executing} className="flex-1 rounded bg-red-600 py-1.5 text-xs text-white disabled:opacity-40">
                    {executing ? '...' : 'تنفيذ'}
                  </button>
                </div>
              </div>
            ) : (
              /* Action categories */
              <div className="space-y-2">
                {MOD_CATEGORIES.map(cat => {
                  const visible = cat.actions.filter(a => {
                    if (a.key.startsWith('visibility.')) return userPerms.includes('admin.manage_users')
                    // Map action key to permission
                    const permKey = a.key.startsWith('mod.') ? a.key : `mod.${a.key}`
                    return availablePerms.includes(permKey) || availablePerms.includes(a.key)
                  })
                  if (visible.length === 0) return null

                  return (
                    <div key={cat.label}>
                      <p className="text-[10px] text-gray-400 font-bold mb-1">{cat.label}</p>
                      <div className="flex flex-wrap gap-1">
                        {visible.map(action => (
                          <button key={action.key} onClick={() => setActiveAction(action.key)}
                            className={`rounded ${action.color} px-2 py-1 text-[10px] text-white hover:opacity-80`}>
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
