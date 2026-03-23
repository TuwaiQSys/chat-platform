import { useEffect, useState } from 'react'
import { Plus, Trash2, Save, X, Lock } from 'lucide-react'

interface RoleRecord {
  _id: string
  name: string
  nameAr: string
  permissions: string[]
  priority: number
  isSystem: boolean
  visibility: string
  color: string | null
  badge: string | null
}

interface PermCategory {
  nameAr: string
  keys: string[]
}

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [allPerms, setAllPerms] = useState<Record<string, string>>({})
  const [categories, setCategories] = useState<Record<string, PermCategory>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<RoleRecord>>({})
  const [creating, setCreating] = useState(false)
  const [newRole, setNewRole] = useState({ name: '', nameAr: '', priority: 50, color: '#3b82f6', badge: '', visibility: 'visible', permissions: [] as string[] })
  const token = localStorage.getItem('token')

  const fetchRoles = () => {
    fetch('/api/admin/roles', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setRoles(d.roles))
  }

  const fetchPerms = () => {
    fetch('/api/admin/permissions', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setAllPerms(d.permissions); setCategories(d.categories) })
  }

  useEffect(() => { fetchRoles(); fetchPerms() }, [])

  const startEdit = (role: RoleRecord) => {
    setEditing(role._id)
    setEditData({ ...role })
  }

  const saveEdit = async () => {
    if (!editing) return
    await fetch(`/api/admin/roles/${editing}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(editData),
    })
    setEditing(null)
    fetchRoles()
  }

  const createRole = async () => {
    await fetch('/api/admin/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newRole),
    })
    setCreating(false)
    setNewRole({ name: '', nameAr: '', priority: 50, color: '#3b82f6', badge: '', visibility: 'visible', permissions: [] })
    fetchRoles()
  }

  const deleteRole = async (id: string) => {
    if (!confirm('حذف هذا الدور؟')) return
    await fetch(`/api/admin/roles/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    fetchRoles()
  }

  const togglePerm = (perms: string[], key: string): string[] => {
    return perms.includes(key) ? perms.filter((p) => p !== key) : [...perms, key]
  }

  // Permission matrix component
  const PermMatrix = ({ permissions, onChange }: { permissions: string[]; onChange: (p: string[]) => void }) => (
    <div className="space-y-4 mt-3">
      {Object.entries(categories).map(([catKey, cat]) => (
        <div key={catKey}>
          <h4 className="text-xs font-bold text-gray-400 mb-1.5">{cat.nameAr}</h4>
          <div className="grid grid-cols-2 gap-1">
            {cat.keys.map((key) => (
              <label key={key} className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-gray-700/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissions.includes(key)}
                  onChange={() => onChange(togglePerm(permissions, key))}
                  className="accent-blue-500"
                />
                <span className="text-gray-300">{allPerms[key] || key}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">الأدوار والصلاحيات</h1>
        <button onClick={() => setCreating(!creating)} className="flex items-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          دور جديد
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4 mb-4 space-y-3 animate-fade-in">
          <h3 className="text-sm font-bold text-white">إنشاء دور جديد</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={newRole.name} onChange={(e) => setNewRole({ ...newRole, name: e.target.value })} placeholder="الاسم (إنجليزي)..." className="rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white" dir="ltr" />
            <input value={newRole.nameAr} onChange={(e) => setNewRole({ ...newRole, nameAr: e.target.value })} placeholder="الاسم (عربي)..." className="rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white" dir="auto" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">الأولوية:</label>
              <input type="number" value={newRole.priority} onChange={(e) => setNewRole({ ...newRole, priority: Number(e.target.value) })} className="w-20 rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400">اللون:</label>
              <input type="color" value={newRole.color} onChange={(e) => setNewRole({ ...newRole, color: e.target.value })} className="h-8 w-12 rounded border border-gray-600 bg-gray-700 cursor-pointer" />
              <input value={newRole.badge} onChange={(e) => setNewRole({ ...newRole, badge: e.target.value })} placeholder="الشارة" className="w-16 rounded border border-gray-600 bg-gray-700 px-2 py-1.5 text-sm text-white" />
            </div>
          </div>
          <PermMatrix permissions={newRole.permissions} onChange={(p) => setNewRole({ ...newRole, permissions: p })} />
          <div className="flex gap-2">
            <button onClick={createRole} className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700">إنشاء</button>
            <button onClick={() => setCreating(false)} className="rounded bg-gray-700 px-4 py-1.5 text-sm text-gray-300 hover:bg-gray-600">إلغاء</button>
          </div>
        </div>
      )}

      {/* Roles list */}
      <div className="space-y-3">
        {roles.map((role) => (
          <div key={role._id} className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            {editing === role._id ? (
              /* Edit mode */
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input value={editData.nameAr || ''} onChange={(e) => setEditData({ ...editData, nameAr: e.target.value })} className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white" dir="auto" />
                    <input type="number" value={editData.priority ?? 0} onChange={(e) => setEditData({ ...editData, priority: Number(e.target.value) })} className="w-20 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white" />
                    <input type="color" value={editData.color || '#ffffff'} onChange={(e) => setEditData({ ...editData, color: e.target.value })} className="h-7 w-10 rounded border border-gray-600 bg-gray-700 cursor-pointer" />
                    <input value={editData.badge || ''} onChange={(e) => setEditData({ ...editData, badge: e.target.value })} placeholder="شارة" className="w-14 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-sm text-white" />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={saveEdit} className="rounded bg-green-600 p-1.5 text-white hover:bg-green-700"><Save className="h-4 w-4" /></button>
                    <button onClick={() => setEditing(null)} className="rounded bg-gray-600 p-1.5 text-white hover:bg-gray-500"><X className="h-4 w-4" /></button>
                  </div>
                </div>
                <PermMatrix permissions={editData.permissions || []} onChange={(p) => setEditData({ ...editData, permissions: p })} />
              </div>
            ) : (
              /* View mode */
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {role.color && <div className="h-3 w-3 rounded-full" style={{ background: role.color }} />}
                  <span className="font-bold text-white">{role.badge} {role.nameAr}</span>
                  <span className="text-xs text-gray-500" dir="ltr">{role.name}</span>
                  <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">أولوية: {role.priority}</span>
                  <span className="rounded bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-400">{role.permissions.length} صلاحية</span>
                  {role.isSystem && <Lock className="h-3 w-3 text-gray-500" />}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(role)} className="rounded bg-gray-700 px-2 py-1 text-xs text-gray-300 hover:bg-gray-600">تعديل</button>
                  {!role.isSystem && (
                    <button onClick={() => deleteRole(role._id)} className="rounded bg-gray-700 p-1 text-red-400 hover:bg-red-900/30"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
