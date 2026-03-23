import { useEffect, useState } from 'react'
import { Users, Hash, MessageSquare, Shield } from 'lucide-react'

interface Stats {
  users: { total: number; guests: number; members: number; admins: number }
  rooms: number
  messages: number
  moderation: { activeActions: number; pendingReports: number }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
  }, [])

  if (!stats) return <div className="p-6 text-white/30">جاري التحميل...</div>

  const cards = [
    { label: 'إجمالي المستخدمين', value: stats.users.total, sub: `${stats.users.members} عضو • ${stats.users.guests} زائر`, icon: Users, color: 'bg-indigo-600/10 text-indigo-400' },
    { label: 'الغرف النشطة', value: stats.rooms, icon: Hash, color: 'bg-emerald-600/10 text-emerald-400' },
    { label: 'الرسائل', value: stats.messages, icon: MessageSquare, color: 'bg-purple-600/10 text-purple-400' },
    { label: 'إجراءات الإشراف', value: stats.moderation.activeActions, sub: 'نشطة الآن', icon: Shield, color: 'bg-red-600/10 text-red-400' },
  ]

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-6">نظرة عامة</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-white/40">{card.label}</span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-white">{card.value.toLocaleString('ar-SA')}</p>
              {card.sub && <p className="mt-1 text-xs text-white/25">{card.sub}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
