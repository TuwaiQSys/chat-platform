import { useEffect, useState } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface RoleInfo { _id: string; name: string; nameAr: string; color: string | null; badge: string | null; priority: number }
interface UserRecord {
  _id: string
  nickname: string
  username?: string
  email?: string
  type: string
  status: string
  avatarColor: string
  visibility: string
  lastIp: string
  roles: RoleInfo[]
  membershipPlan?: string
  createdAt: string
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-600/20 text-green-400 border-green-600/30',
  suspended: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  banned: 'bg-red-600/20 text-red-400 border-red-600/30',
}

const TYPE_LABELS: Record<string, string> = { guest: 'زائر', member: 'عضو', staff: 'طاقم' }

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [allRoles, setAllRoles] = useState<RoleInfo[]>([])
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
      .then((d) => { setUsers(d.users); setTotal(d.total); setPages(d.pages) })
  }

  useEffect(() => {
    fetch('/api/admin/roles', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setAllRoles(d.roles))
  }, [])

  useEffect(() => { fetchUsers() }, [page, typeFilter])

  const updateStatus = async (userId: string, status: string) => {
    await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })
    fetchUsers()
  }

  const updateRoles = async (userId: string, roleIds: string[]) => {
    await fetch(`/api/admin/users/${userId}/roles`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ roleIds }),
    })
    fetchUsers()
  }

  const updateVisibility = async (userId: string, visibility: string) => {
    await fetch(`/api/admin/users/${userId}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ visibility }),
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
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchUsers())}
            placeholder="بحث بالاسم..."
            className="w-full rounded border border-gray-600 bg-gray-700 pr-9 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            dir="auto"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-gray-300"
        >
          <option value="">الكل</option>
          <option value="guest">زائر</option>
          <option value="member">عضو</option>
          <option value="staff">طاقم</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400">
              <th className="px-3 py-3 text-right font-medium">المستخدم</th>
              <th className="px-3 py-3 text-right font-medium">النوع</th>
              <th className="px-3 py-3 text-right font-medium">IP</th>
              <th className="px-3 py-3 text-right font-medium">الأدوار</th>
              <th className="px-3 py-3 text-right font-medium">الحالة</th>
              <th className="px-3 py-3 text-right font-medium">الرؤية</th>
              <th className="px-3 py-3 text-right font-medium">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u._id} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: u.avatarColor }}>
                      {u.nickname.charAt(0)}
                    </div>
                    <div>
                      <p className="text-white font-medium">{u.nickname}</p>
                      {u.email && <p className="text-[10px] text-gray-500" dir="ltr">{u.email}</p>}
                      {u.username && <p className="text-[10px] text-gray-500" dir="ltr">@{u.username}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-gray-400 text-xs">{TYPE_LABELS[u.type] || u.type}</td>
                <td className="px-3 py-2.5 text-gray-500 text-xs font-mono" dir="ltr">{u.lastIp || '—'}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 flex-wrap">
                    {u.roles.map((r) => (
                      <span key={r._id} className="rounded px-1 py-0.5 text-[10px] text-white" style={{ background: r.color || '#4b5563' }}>
                        {r.badge} {r.nameAr}
                      </span>
                    ))}
                    {u.roles.length === 0 && <span className="text-[10px] text-gray-600">بدون دور</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <select
                    value={u.status}
                    onChange={(e) => updateStatus(u._id, e.target.value)}
                    className={`rounded border px-2 py-0.5 text-xs ${STATUS_COLORS[u.status] || ''}`}
                  >
                    <option value="active">نشط</option>
                    <option value="suspended">موقوف</option>
                    <option value="banned">محظور</option>
                  </select>
                </td>
                <td className="px-3 py-2.5">
                  <select
                    value={u.visibility}
                    onChange={(e) => updateVisibility(u._id, e.target.value)}
                    className="rounded border border-gray-600 bg-gray-700 px-2 py-0.5 text-xs text-gray-300"
                  >
                    <option value="visible">ظاهر</option>
                    <option value="hidden">مخفي</option>
                    <option value="royal_hidden">مخفي ملكي</option>
                  </select>
                </td>
                <td className="px-3 py-2.5 text-gray-500 text-[10px]">{new Date(u.createdAt).toLocaleDateString('ar-SA')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-20">
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-500">{page} / {pages}</span>
          <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages} className="p-1.5 text-gray-400 hover:text-white disabled:opacity-20">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
