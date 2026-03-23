import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './hooks/useStore'
import { useSocket } from './hooks/useSocket'
import EntryPage from './pages/EntryPage'
import LobbyPage from './pages/LobbyPage'
import ChatRoomPage from './pages/ChatRoomPage'
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
    return <Navigate to="/lobby" replace />
  }
  return <>{children}</>
}

export default function App() {
  useSocket()

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<RequireGuest><EntryPage /></RequireGuest>} />

      {/* Chat (guest + member) */}
      <Route path="/lobby" element={<RequireAuth><LobbyPage /></RequireAuth>} />
      <Route path="/room/:roomId" element={<RequireAuth><ChatRoomPage /></RequireAuth>} />

      {/* Admin panel */}
      <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="moderation" element={<ModerationPage />} />
        <Route path="memberships" element={<MembershipsPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
    </Routes>
  )
}
