import { useEffect, useState } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface UserRecord {
  _id: string
  nickname: string
  email?: string
  type: string
  systemRole: string
  status: string
  avatarColor: string
  membershipPlan?: string
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = { user: 'مستخدم', moderator: 'مشرف', admin: 'مسؤول' }
const STATUS_LABELS: Record<string, string> = { active: 'نشط', suspended: 'موقوف', banned: 'محظور' }
const TYPE_LABELS: Record<string, string> = { guest: 'زائر', member: 'عضو', admin: 'مسؤول' }

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const token = localStorage.getItem('token')

  const fetchUsers = () => {
    const params = new URLSearchParams({ page: String(page), limit: '15' })
    if (search) params.set('search', search)
    if (typeFilter) params.set('type', typeFilter)

    fetch(`/api/admin/users?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users)
        setTotal(data.total)
        setPages(data.pages)
      })
  }

  useEffect(() => { fetchUsers() }, [page, typeFilter])

  const updateRole = async (userId: string, systemRole: string) => {
    await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ systemRole }),
    })
    fetchUsers()
  }

  const updateStatus = async (userId: string, status: string) => {
    await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })
    fetchUsers()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">المستخدمين ({total})</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchUsers())}
            placeholder="بحث بالاسم..."
            className="input-dark pr-9 py-2 text-sm"
            dir="auto"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 focus:outline-none"
        >
          <option value="">الكل</option>
          <option value="guest">زائر</option>
          <option value="member">عضو</option>
          <option value="admin">مسؤول</option>
        </select>
      </div>

      {/* Table */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-white/30">
              <th className="px-4 py-3 text-right font-medium">المستخدم</th>
              <th className="px-4 py-3 text-right font-medium">النوع</th>
              <th className="px-4 py-3 text-right font-medium">الدور</th>
              <th className="px-4 py-3 text-right font-medium">الحالة</th>
              <th className="px-4 py-3 text-right font-medium">العضوية</th>
              <th className="px-4 py-3 text-right font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: u.avatarColor }}
                    >
                      {u.nickname.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white/80 font-medium">{u.nickname}</p>
                      {u.email && <p className="text-[11px] text-white/20" dir="ltr">{u.email}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-white/40">{TYPE_LABELS[u.type] || u.type}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.systemRole}
                    onChange={(e) => updateRole(u._id, e.target.value)}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/60"
                  >
                    <option value="user">مستخدم</option>
                    <option value="moderator">مشرف</option>
                    <option value="admin">مسؤول</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.status}
                    onChange={(e) => updateStatus(u._id, e.target.value)}
                    className={`rounded-md border px-2 py-1 text-xs ${
                      u.status === 'active' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                      : u.status === 'banned' ? 'border-red-500/20 bg-red-500/10 text-red-400'
                      : 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400'
                    }`}
                  >
                    <option value="active">نشط</option>
                    <option value="suspended">موقوف</option>
                    <option value="banned">محظور</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-white/30 text-xs">{u.membershipPlan || '—'}</td>
                <td className="px-4 py-3 text-white/20 text-xs">
                  {new Date(u.createdAt).toLocaleDateString('ar-SA')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="btn-ghost p-1.5 disabled:opacity-20"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="text-sm text-white/40">{page} / {pages}</span>
          <button
            onClick={() => setPage(Math.min(pages, page + 1))}
            disabled={page >= pages}
            className="btn-ghost p-1.5 disabled:opacity-20"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
