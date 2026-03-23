import { useState, useEffect, useRef } from 'react'
import { socket } from '@/lib/socket'
import { useStore, type ChatUser } from '@/hooks/useStore'

interface Props {
  target: ChatUser
  roomId: string
  position: { x: number; y: number }
  onClose: () => void
}

const ACTION_LABELS: Record<string, string> = {
  mute: '🔇 كتم',
  kick: '🚪 طرد',
  ban: '⛔ حظر',
  warn: '⚠️ تحذير',
  shadow_ban: '👻 حظر خفي',
}

const DURATIONS = [
  { label: '5 دقائق', value: 5 },
  { label: '15 دقيقة', value: 15 },
  { label: 'ساعة', value: 60 },
  { label: 'يوم', value: 1440 },
  { label: 'دائم', value: 0 },
]

export default function UserActionMenu({ target, roomId, position, onClose }: Props) {
  const user = useStore((s) => s.user)
  const [actions, setActions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState(15)
  const [executing, setExecuting] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    socket.emit('mod:check-permissions', { targetUserId: target.id, roomId }, (res: any) => {
      setActions(res.actions || [])
      setLoading(false)
    })
  }, [target.id, roomId])

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const execute = () => {
    if (!selected || executing) return
    setExecuting(true)
    socket.emit('mod:action', {
      action: selected,
      targetUserId: target.id,
      roomId,
      reason: reason || 'مخالفة',
      duration: ['mute', 'ban', 'shadow_ban'].includes(selected) ? duration : undefined,
    }, (res: any) => {
      setExecuting(false)
      if (res.error) return alert(res.error)
      onClose()
    })
  }

  if (target.id === user?.id) return null

  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(position.y, window.innerHeight - 300),
    left: Math.min(position.x, window.innerWidth - 220),
    zIndex: 50,
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div ref={ref} style={style} className="w-52 rounded border border-amber-200 bg-white shadow-xl animate-fade-in">
        {/* Header */}
        <div className="border-b border-amber-100 px-3 py-2 flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: target.avatar }}>
            {target.nickname.charAt(0)}
          </div>
          <span className="text-sm font-bold text-gray-700">{target.nickname}</span>
        </div>

        {loading ? (
          <div className="px-3 py-3 text-center text-xs text-gray-400">جاري التحقق...</div>
        ) : actions.length === 0 ? (
          <div className="px-3 py-3 text-center text-xs text-gray-400">لا توجد صلاحيات</div>
        ) : !selected ? (
          <div className="py-1">
            {actions.map((action) => (
              <button
                key={action}
                onClick={() => setSelected(action)}
                className="w-full px-3 py-1.5 text-right text-sm text-gray-600 hover:bg-amber-50 transition-colors"
              >
                {ACTION_LABELS[action] || action}
              </button>
            ))}
          </div>
        ) : (
          <div className="p-3 space-y-2">
            <p className="text-xs text-gray-500">{ACTION_LABELS[selected]} — {target.nickname}</p>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="السبب..."
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs focus:border-amber-400 focus:outline-none"
              dir="auto"
              autoFocus
            />
            {['mute', 'ban', 'shadow_ban'].includes(selected) && (
              <div className="flex flex-wrap gap-1">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDuration(d.value)}
                    className={`rounded px-1.5 py-0.5 text-[10px] ${duration === d.value ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setSelected(null)} className="flex-1 rounded bg-gray-100 py-1 text-xs text-gray-500 hover:bg-gray-200">رجوع</button>
              <button onClick={execute} disabled={executing} className="flex-1 rounded bg-red-600 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-40">
                {executing ? '...' : 'تنفيذ'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
