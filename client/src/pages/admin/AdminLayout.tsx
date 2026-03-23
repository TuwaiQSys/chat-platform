import { useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Hash, Shield, CreditCard, ScrollText, LogOut } from 'lucide-react'
import { useStore } from '@/hooks/useStore'

const NAV_ITEMS = [
  { to: '/admin', icon: LayoutDashboard, label: 'لوحة التحكم', end: true },
  { to: '/admin/users', icon: Users, label: 'المستخدمين' },
  { to: '/admin/rooms', icon: Hash, label: 'الغرف' },
  { to: '/admin/moderation', icon: Shield, label: 'الإشراف' },
  { to: '/admin/memberships', icon: CreditCard, label: 'العضويات' },
  { to: '/admin/audit', icon: ScrollText, label: 'السجل' },
]

export default function AdminLayout() {
  const user = useStore((s) => s.user)
  const setUser = useStore((s) => s.setUser)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user || (user as any).type !== 'admin') {
      navigate('/')
    }
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
      <aside className="flex w-56 shrink-0 flex-col border-l border-white/5 bg-[#0a0a14]">
        <div className="border-b border-white/5 px-4 py-4">
          <h2 className="text-base font-bold text-white">لوحة التحكم</h2>
          <p className="text-xs text-white/30 mt-0.5">{user.nickname}</p>
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
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-300 font-medium'
                      : 'text-white/40 hover:bg-white/[0.03] hover:text-white/60'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-white/5 p-2">
          <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/30 hover:bg-white/[0.03] hover:text-red-400 transition-colors">
            <LogOut className="h-4 w-4" />
            خروج
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
