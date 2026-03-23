import { useEffect, useState } from 'react'
import { XCircle } from 'lucide-react'

interface ModAction {
  _id: string
  type: string
  targetUserId: { nickname: string; avatarColor: string } | null
  moderatorId: { nickname: string } | null
  roomId: { name: string } | null
  reason: string
  active: boolean
  expiresAt?: string
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  mute: 'كتم',
  ban: 'حظر',
  kick: 'طرد',
  warn: 'تحذير',
  shadow_ban: 'حظر خفي',
  message_removed: 'حذف رسالة',
}

export default function ModerationPage() {
  const [actions, setActions] = useState<ModAction[]>([])
  const [total, setTotal] = useState(0)
  const [activeOnly, setActiveOnly] = useState(true)
  const token = localStorage.getItem('token')

  const fetchActions = () => {
    const params = new URLSearchParams({ page: '1', limit: '30' })
    if (activeOnly) params.set('active', 'true')

    fetch(`/api/admin/moderation/actions?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { setActions(data.actions); setTotal(data.total) })
  }

  useEffect(() => { fetchActions() }, [activeOnly])

  const revokeAction = async (actionId: string) => {
    await fetch(`/api/admin/moderation/actions/${actionId}/revoke`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    })
    fetchActions()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">الإشراف ({total})</h1>
        <button
          onClick={() => setActiveOnly(!activeOnly)}
          className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
            activeOnly ? 'bg-indigo-600/20 text-indigo-300' : 'bg-white/5 text-white/40'
          }`}
        >
          {activeOnly ? 'النشطة فقط' : 'الكل'}
        </button>
      </div>

      <div className="space-y-2">
        {actions.map((action) => (
          <div key={action._id} className="glass rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                action.type === 'ban' ? 'bg-red-500/15 text-red-400'
                : action.type === 'mute' ? 'bg-yellow-500/15 text-yellow-400'
                : action.type === 'kick' ? 'bg-orange-500/15 text-orange-400'
                : 'bg-white/5 text-white/40'
              }`}>
                {TYPE_LABELS[action.type] || action.type}
              </div>
              <div>
                <p className="text-sm text-white/70">
                  <span className="text-white/90 font-medium">{action.targetUserId?.nickname || '—'}</span>
                  {action.roomId && <span className="text-white/30"> في {action.roomId.name}</span>}
                </p>
                <p className="text-xs text-white/25">
                  بواسطة {action.moderatorId?.nickname || '—'} • {action.reason}
                  {action.expiresAt && <span> • ينتهي {new Date(action.expiresAt).toLocaleDateString('ar-SA')}</span>}
                </p>
              </div>
            </div>

            {action.active && (
              <button
                onClick={() => revokeAction(action._id)}
                className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
                إلغاء
              </button>
            )}
          </div>
        ))}

        {actions.length === 0 && (
          <div className="py-12 text-center text-white/20 text-sm">لا توجد إجراءات</div>
        )}
      </div>
    </div>
  )
}
