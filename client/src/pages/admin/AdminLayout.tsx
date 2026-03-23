import { useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Hash, Shield, CreditCard, ScrollText, LogOut, Key, UserCog, Megaphone, ShieldAlert } from 'lucide-react'
import { useStore } from '@/hooks/useStore'

const NAV_ITEMS = [
  { to: '/admin', icon: LayoutDashboard, label: 'لوحة التحكم', end: true },
  { to: '/admin/users', icon: Users, label: 'المستخدمين' },
  { to: '/admin/roles', icon: Key, label: 'الأدوار' },
  { to: '/admin/staff', icon: UserCog, label: 'الطاقم' },
  { to: '/admin/rooms', icon: Hash, label: 'الغرف' },
  { to: '/admin/moderation', icon: Shield, label: 'الإشراف' },
  { to: '/admin/broadcast', icon: Megaphone, label: 'البث' },
  { to: '/admin/anti-abuse', icon: ShieldAlert, label: 'مكافحة الإساءة' },
  { to: '/admin/memberships', icon: CreditCard, label: 'العضويات' },
  { to: '/admin/audit', icon: ScrollText, label: 'السجل' },
]

export default function AdminLayout() {
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return navigate('/')
    // Check if user has any admin permission
    const perms = user.permissions || []
    const hasAdmin = perms.some((p) => p.startsWith('admin.') || p.startsWith('mod.'))
    if (!hasAdmin) navigate('/chat')
  }, [user, navigate])

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
    navigate('/')
  }

  if (!user) return null

  return (
    <div className="flex h-full" dir="rtl">
      {/* Sidebar */}
      <aside className="flex w-52 shrink-0 flex-col border-l border-gray-700 bg-[#1a1f2e]">
        <div className="border-b border-gray-700 px-4 py-4">
          <h2 className="text-base font-bold text-white">لوحة التحكم</h2>
          <p className="text-xs text-gray-500 mt-0.5">{user.nickname}</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
                    isActive ? 'bg-blue-600/20 text-blue-400 font-medium' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-gray-700 p-2">
          <button onClick={() => navigate('/chat')} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-gray-400 hover:bg-gray-700/50 hover:text-white">
            العودة للشات
          </button>
          <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-gray-400 hover:bg-gray-700/50 hover:text-red-400">
            <LogOut className="h-4 w-4" />
            خروج
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-[#0f1219]">
        <Outlet />
      </main>
    </div>
  )
}
