import { useState, useEffect, useRef } from 'react'
import { Ban, VolumeX, LogOut, AlertTriangle, Eye, X } from 'lucide-react'
import { socket } from '@/lib/socket'
import { useStore, type ChatUser } from '@/hooks/useStore'

interface Props {
  target: ChatUser
  roomId: string
  position: { x: number; y: number }
  onClose: () => void
}

const ACTION_CONFIG = {
  mute: { icon: VolumeX, label: 'كتم', color: 'text-yellow-400', bg: 'hover:bg-yellow-500/10' },
  kick: { icon: LogOut, label: 'طرد', color: 'text-orange-400', bg: 'hover:bg-orange-500/10' },
  ban: { icon: Ban, label: 'حظر', color: 'text-red-400', bg: 'hover:bg-red-500/10' },
  warn: { icon: AlertTriangle, label: 'تحذير', color: 'text-amber-400', bg: 'hover:bg-amber-500/10' },
  shadow_ban: { icon: Eye, label: 'حظر خفي', color: 'text-purple-400', bg: 'hover:bg-purple-500/10' },
} as const

const DURATION_OPTIONS = [
  { label: '5 دقائق', value: 5 },
  { label: '15 دقيقة', value: 15 },
  { label: 'ساعة', value: 60 },
  { label: 'يوم', value: 1440 },
  { label: 'دائم', value: 0 },
]

export default function UserActionMenu({ target, roomId, position, onClose }: Props) {
  const user = useStore((s) => s.user)
  const [allowedActions, setAllowedActions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState(15)
  const [executing, setExecuting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fetch allowed actions
  useEffect(() => {
    socket.emit('mod:check-permissions', { targetUserId: target.id, roomId }, (res: any) => {
      setAllowedActions(res.actions || [])
      setLoading(false)
    })
  }, [target.id, roomId])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const executeAction = () => {
    if (!selectedAction || executing) return
    setExecuting(true)

    socket.emit('mod:action', {
      action: selectedAction,
      targetUserId: target.id,
      roomId,
      reason: reason || 'مخالفة',
      duration: ['mute', 'ban', 'shadow_ban'].includes(selectedAction) ? duration : undefined,
    }, (res: any) => {
      setExecuting(false)
      if (res.error) {
        alert(res.error)
        return
      }
      onClose()
    })
  }

  if (target.id === user?.id) return null

  // Clamp position to viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(position.y, window.innerHeight - 350),
    left: Math.min(position.x, window.innerWidth - 260),
    zIndex: 50,
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div ref={menuRef} style={menuStyle} className="w-60 animate-fade-in rounded-xl border border-white/10 bg-[#12121f] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
          <div className="flex items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: target.avatar }}
            >
              {target.nickname.charAt(0)}
            </div>
            <span className="text-sm font-medium text-white">{target.nickname}</span>
          </div>
          <button onClick={onClose} className="p-1 text-white/30 hover:text-white/60">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="px-3 py-4 text-center text-xs text-white/30">جاري التحقق...</div>
        ) : allowedActions.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-white/30">لا توجد صلاحيات</div>
        ) : !selectedAction ? (
          /* Action list */
          <div className="p-1.5">
            {allowedActions.map((action) => {
              const config = ACTION_CONFIG[action as keyof typeof ACTION_CONFIG]
              if (!config) return null
              const Icon = config.icon
              return (
                <button
                  key={action}
                  onClick={() => setSelectedAction(action)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${config.bg}`}
                >
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className="text-white/70">{config.label}</span>
                </button>
              )
            })}
          </div>
        ) : (
          /* Action form */
          <div className="p-3 space-y-3">
            <div className="text-xs text-white/40">
              {ACTION_CONFIG[selectedAction as keyof typeof ACTION_CONFIG]?.label} — {target.nickname}
            </div>

            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="السبب..."
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder:text-white/20 focus:border-indigo-500/50 focus:outline-none"
              dir="auto"
              autoFocus
            />

            {['mute', 'ban', 'shadow_ban'].includes(selectedAction) && (
              <div className="flex flex-wrap gap-1.5">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDuration(opt.value)}
                    className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                      duration === opt.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/5 text-white/40 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedAction(null)}
                className="flex-1 rounded-lg bg-white/5 py-1.5 text-xs text-white/50 hover:bg-white/10 transition-colors"
              >
                رجوع
              </button>
              <button
                onClick={executeAction}
                disabled={executing}
                className="flex-1 rounded-lg bg-red-600/80 py-1.5 text-xs font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-40"
              >
                {executing ? 'جاري...' : 'تنفيذ'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
