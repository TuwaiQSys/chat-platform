import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'

interface RoleRecord { _id: string; name: string; nameAr: string; color: string | null; badge: string | null }
interface StaffRecord { _id: string; nickname: string; username: string; avatarColor: string; roles: RoleRecord[]; createdAt: string }

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffRecord[]>([])
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', nickname: '', password: '', roleNames: [] as string[] })
  const [error, setError] = useState('')
  const token = localStorage.getItem('token')

  const fetchStaff = () => {
    fetch('/api/admin/users?type=staff&limit=50', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setStaff(d.users))
  }

  const fetchRoles = () => {
    fetch('/api/admin/roles', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setRoles(d.roles))
  }

  useEffect(() => { fetchStaff(); fetchRoles() }, [])

  const createStaff = async () => {
    setError('')
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.error) return setError(data.error)
    setShowForm(false)
    setForm({ username: '', nickname: '', password: '', roleNames: [] })
    fetchStaff()
  }

  const toggleRole = (name: string) => {
    setForm((f) => ({
      ...f,
      roleNames: f.roleNames.includes(name) ? f.roleNames.filter((r) => r !== name) : [...f.roleNames, name],
    }))
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">طاقم العمل ({staff.length})</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">
          <UserPlus className="h-4 w-4" />
          إنشاء حساب طاقم
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 mb-4 space-y-3 animate-fade-in">
          <h3 className="text-sm font-bold text-white">حساب طاقم جديد</h3>
          <div className="grid grid-cols-3 gap-3">
            <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="اسم المستخدم (إنجليزي)" className="rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white" dir="ltr" />
            <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="الاسم المستعار (عربي)" className="rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white" dir="auto" />
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="كلمة المرور" className="rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white" dir="ltr" />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">الأدوار:</label>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <button
                  key={role._id}
                  onClick={() => toggleRole(role.name)}
                  className={`rounded px-2 py-1 text-xs transition-colors ${
                    form.roleNames.includes(role.name) ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {role.badge} {role.nameAr}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={createStaff} className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">إنشاء</button>
            <button onClick={() => setShowForm(false)} className="rounded bg-gray-700 px-4 py-1.5 text-sm text-gray-300">إلغاء</button>
          </div>
        </div>
      )}

      {/* Staff list */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="px-4 py-3 text-right font-medium">الطاقم</th>
              <th className="px-4 py-3 text-right font-medium">اسم المستخدم</th>
              <th className="px-4 py-3 text-right font-medium">الأدوار</th>
              <th className="px-4 py-3 text-right font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s._id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: s.avatarColor }}>
                      {s.nickname.charAt(0)}
                    </div>
                    <span className="text-white">{s.nickname}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400" dir="ltr">{s.username}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {s.roles.map((r) => (
                      <span key={r._id} className="rounded px-1.5 py-0.5 text-[10px] text-white" style={{ background: r.color || '#4b5563' }}>
                        {r.badge} {r.nameAr}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(s.createdAt).toLocaleDateString('ar-SA')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
