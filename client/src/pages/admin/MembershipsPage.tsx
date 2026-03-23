import { useEffect, useState } from 'react'
import { CreditCard, Edit2, Check, X } from 'lucide-react'

interface Plan {
  _id: string
  name: string
  nameAr: string
  price: number
  currency: string
  durationDays: number
  permissions: Record<string, unknown>
  active: boolean
  sortOrder: number
}

export default function MembershipsPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Plan>>({})
  const token = localStorage.getItem('token')

  const fetchPlans = () => {
    fetch('/api/admin/plans', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setPlans(data.plans))
  }

  useEffect(() => { fetchPlans() }, [])

  const startEdit = (plan: Plan) => {
    setEditing(plan._id)
    setEditData({ nameAr: plan.nameAr, price: plan.price, durationDays: plan.durationDays })
  }

  const saveEdit = async (planId: string) => {
    await fetch(`/api/admin/plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(editData),
    })
    setEditing(null)
    fetchPlans()
  }

  const toggleActive = async (planId: string, active: boolean) => {
    await fetch(`/api/admin/plans/${planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ active }),
    })
    fetchPlans()
  }

  const PERM_LABELS: Record<string, string> = {
    canUploadAvatar: 'رفع صورة',
    canUploadMedia: 'رفع وسائط',
    canCreateRooms: 'إنشاء غرف',
    maxRoomsOwned: 'أقصى عدد غرف',
    nicknameColor: 'لون الاسم',
    canChangeNicknameColor: 'تغيير لون الاسم',
    canSendPrivateMessages: 'رسائل خاصة',
    hasBubbleStyle: 'فقاعة مميزة',
    badge: 'الشارة',
    entryEffect: 'تأثير الدخول',
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-6">العضويات</h1>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan._id} className={`glass rounded-xl p-5 ${!plan.active ? 'opacity-40' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-indigo-400" />
                {editing === plan._id ? (
                  <input
                    value={editData.nameAr || ''}
                    onChange={(e) => setEditData({ ...editData, nameAr: e.target.value })}
                    className="rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-white w-24"
                    dir="auto"
                  />
                ) : (
                  <h3 className="text-lg font-bold text-white">{plan.nameAr}</h3>
                )}
              </div>

              <div className="flex items-center gap-1">
                {editing === plan._id ? (
                  <>
                    <button onClick={() => saveEdit(plan._id)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => setEditing(null)} className="p-1 text-white/30 hover:bg-white/5 rounded">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <button onClick={() => startEdit(plan)} className="p-1 text-white/20 hover:text-white/50 rounded">
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="mb-4">
              {editing === plan._id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={editData.price ?? 0}
                    onChange={(e) => setEditData({ ...editData, price: Number(e.target.value) })}
                    className="w-20 rounded border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                  />
                  <span className="text-xs text-white/30">{plan.currency}</span>
                </div>
              ) : (
                <p className="text-2xl font-bold text-white">
                  {plan.price === 0 ? 'مجاني' : `${plan.price} ${plan.currency}`}
                  {plan.durationDays > 0 && <span className="text-sm font-normal text-white/30"> / {plan.durationDays} يوم</span>}
                </p>
              )}
            </div>

            {/* Permissions */}
            <div className="space-y-1.5 border-t border-white/5 pt-3">
              {Object.entries(plan.permissions).map(([key, value]) => {
                const label = PERM_LABELS[key] || key
                return (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="text-white/40">{label}</span>
                    <span className={typeof value === 'boolean' ? (value ? 'text-emerald-400' : 'text-red-400/50') : 'text-white/60'}>
                      {typeof value === 'boolean' ? (value ? '✓' : '✗') : String(value)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Toggle active */}
            <button
              onClick={() => toggleActive(plan._id, !plan.active)}
              className={`mt-4 w-full rounded-lg py-1.5 text-xs transition-colors ${
                plan.active ? 'bg-white/5 text-white/30 hover:bg-red-500/10 hover:text-red-400' : 'bg-emerald-600/20 text-emerald-400'
              }`}
            >
              {plan.active ? 'تعطيل' : 'تفعيل'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
