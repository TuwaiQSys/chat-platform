import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './hooks/useStore'
import { useSocket } from './hooks/useSocket'
import EntryPage from './pages/EntryPage'
import LobbyPage from './pages/LobbyPage'
import ChatRoomPage from './pages/ChatRoomPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useStore((s) => s.user)
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const user = useStore((s) => s.user)
  if (user) return <Navigate to="/lobby" replace />
  return <>{children}</>
}

export default function App() {
  useSocket()

  return (
    <Routes>
      <Route path="/" element={<RequireGuest><EntryPage /></RequireGuest>} />
      <Route path="/lobby" element={<RequireAuth><LobbyPage /></RequireAuth>} />
      <Route path="/room/:roomId" element={<RequireAuth><ChatRoomPage /></RequireAuth>} />
    </Routes>
  )
}
