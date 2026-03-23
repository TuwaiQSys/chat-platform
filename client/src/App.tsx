import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './hooks/useStore'
import { useSocket } from './hooks/useSocket'
import EntryPage from './pages/EntryPage'
import ChatPage from './pages/ChatPage'
import AdminLayout from './pages/admin/AdminLayout'
import DashboardPage from './pages/admin/DashboardPage'
import UsersPage from './pages/admin/UsersPage'
import RoomsPage from './pages/admin/RoomsPage'
import ModerationPage from './pages/admin/ModerationPage'
import MembershipsPage from './pages/admin/MembershipsPage'
import AuditPage from './pages/admin/AuditPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useStore((s) => s.user)
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const user = useStore((s) => s.user)
  if (user) {
    if ((user as any).type === 'admin') return <Navigate to="/admin" replace />
    return <Navigate to="/chat" replace />
  }
  return <>{children}</>
}

export default function App() {
  useSocket()

  return (
    <Routes>
      <Route path="/" element={<RequireGuest><EntryPage /></RequireGuest>} />
      <Route path="/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />

      {/* Admin */}
      <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="moderation" element={<ModerationPage />} />
        <Route path="memberships" element={<MembershipsPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
