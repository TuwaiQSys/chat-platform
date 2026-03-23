import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './hooks/useStore'
import { useSocket } from './hooks/useSocket'
import EntryPage from './pages/EntryPage'
import LobbyPage from './pages/LobbyPage'
import ChatRoomPage from './pages/ChatRoomPage'

export default function App() {
  const user = useStore((s) => s.user)
  useSocket()

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/lobby" replace /> : <EntryPage />} />
      <Route path="/lobby" element={user ? <LobbyPage /> : <Navigate to="/" replace />} />
      <Route path="/room/:roomId" element={user ? <ChatRoomPage /> : <Navigate to="/" replace />} />
    </Routes>
  )
}
