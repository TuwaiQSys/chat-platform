import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './hooks/useStore'
import { useSocket } from './hooks/useSocket'
import { socket } from './lib/socket'
import EntryPage from './pages/EntryPage'
import ChatPage from './pages/ChatPage'
import AdminLayout from './pages/admin/AdminLayout'
import DashboardPage from './pages/admin/DashboardPage'
import UsersPage from './pages/admin/UsersPage'
import RolesPage from './pages/admin/RolesPage'
import StaffPage from './pages/admin/StaffPage'
import RoomsPage from './pages/admin/RoomsPage'
import ModerationPage from './pages/admin/ModerationPage'
import BroadcastPage from './pages/admin/BroadcastPage'
import AntiAbusePage from './pages/admin/AntiAbusePage'
import MembershipsPage from './pages/admin/MembershipsPage'
import AuditPage from './pages/admin/AuditPage'
import ChatConfigPage from './pages/admin/ChatConfigPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useStore((s) => s.user)
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const user = useStore((s) => s.user)
  if (user) {
    const perms = user.permissions || []
    const hasAdmin = perms.some((p) => p.startsWith('admin.'))
    if (hasAdmin && user.type === 'staff') return <Navigate to="/admin" replace />
    return <Navigate to="/chat" replace />
  }
  return <>{children}</>
}

// Restore session from token on app load
function useSessionRestore() {
  const [restoring, setRestoring] = useState(true)
  const setUser = useStore((s) => s.setUser)
  const setCurrentRoom = useStore((s) => s.setCurrentRoom)
  const setMessages = useStore((s) => s.setMessages)
  const setMembers = useStore((s) => s.setMembers)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const sessionToken = localStorage.getItem('sessionToken')

    if (!token && !sessionToken) { setRestoring(false); return }

    if (!socket.connected) socket.connect()

    const rejoinRoom = () => {
      const lastRoomId = localStorage.getItem('lastRoomId')
      if (lastRoomId) {
        socket.emit('room:join', { roomId: lastRoomId }, (roomRes: any) => {
          if (!roomRes.error) {
            setCurrentRoom(roomRes.room)
            setMessages(roomRes.messages)
            setMembers(roomRes.members)
          }
          setRestoring(false)
        })
      } else {
        setRestoring(false)
      }
    }

    if (token) {
      // Member/staff restore via JWT
      fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => { if (!r.ok) throw new Error(); return r.json() })
        .then((data) => {
          setUser(data.user)
          socket.emit('auth:join', { token }, (res: any) => {
            if (res.error) { setRestoring(false); return }
            setUser(res.user)
            rejoinRoom()
          })
        }).catch(() => { localStorage.removeItem('token'); setRestoring(false) })
    } else if (sessionToken) {
      // Guest restore via session token
      socket.emit('session:restore', { sessionToken }, (res: any) => {
        if (res.error) {
          localStorage.removeItem('sessionToken')
          setRestoring(false)
          return
        }
        setUser(res.user)
        rejoinRoom()
      })
    }
  }, [setUser, setCurrentRoom, setMessages, setMembers])

  return restoring
}

export default function App() {
  useSocket()
  const restoring = useSessionRestore()

  // Show loading while restoring session
  if (restoring) {
    return (
      <div className="flex h-full items-center justify-center bg-[#e5e7eb]">
        <div className="text-center">
          <div className="mb-3 h-8 w-8 mx-auto animate-spin rounded-full border-3 border-gray-300 border-t-blue-500" />
          <p className="text-sm text-gray-500">جاري تحميل الجلسة...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<RequireGuest><EntryPage /></RequireGuest>} />
      <Route path="/chat" element={<RequireAuth><ChatPage /></RequireAuth>} />

      <Route path="/admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="moderation" element={<ModerationPage />} />
        <Route path="broadcast" element={<BroadcastPage />} />
        <Route path="anti-abuse" element={<AntiAbusePage />} />
        <Route path="chat-config" element={<ChatConfigPage />} />
        <Route path="memberships" element={<MembershipsPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
