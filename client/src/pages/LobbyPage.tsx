import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Hash, LogOut, Wifi } from 'lucide-react'
import { socket } from '@/lib/socket'
import { useStore, type ChatRoom } from '@/hooks/useStore'

export default function LobbyPage() {
  const { user, rooms, setRooms, onlineCount, setOnlineCount, setUser, setCurrentRoom, setMessages, setMembers } = useStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetch('/api/rooms')
      .then((r) => r.json())
      .then((data) => {
        setRooms(data.rooms)
        setOnlineCount(data.totalOnline)
      })
      .catch(() => {})
  }, [setRooms, setOnlineCount])

  const joinRoom = (room: ChatRoom) => {
    if (room.memberCount >= room.maxMembers) return

    socket.emit('room:join', { roomId: room.id }, (res: any) => {
      if (res.error) return
      setCurrentRoom(res.room)
      setMessages(res.messages)
      setMembers(res.members)
      navigate(`/room/${room.id}`)
    })
  }

  const handleLogout = () => {
    socket.disconnect()
    setUser(null)
    setCurrentRoom(null)
    setMessages([])
    setMembers([])
    navigate('/')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">الغرف</h1>
          <div className="badge-online">
            <Wifi className="h-3 w-3" />
            <span>{onlineCount} متصل</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/40">{user?.nickname}</span>
          <button onClick={handleLogout} className="btn-ghost p-2" title="خروج">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-lg space-y-2">
          {rooms.map((room, i) => {
            const isFull = room.memberCount >= room.maxMembers
            const fillPercent = (room.memberCount / room.maxMembers) * 100

            return (
              <button
                key={room.id}
                onClick={() => joinRoom(room)}
                disabled={isFull}
                className="glass glass-hover group relative w-full rounded-xl p-4 text-right transition-all duration-200 animate-fade-in disabled:opacity-40"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/10">
                      <Hash className="h-5 w-5 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {room.name}
                      </h3>
                      <p className="text-xs text-white/30">{room.description}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Users className="h-3.5 w-3.5 text-white/40" />
                      <span className={isFull ? 'text-red-400 font-medium' : 'text-white/50'}>
                        {room.memberCount}/{room.maxMembers}
                      </span>
                    </div>
                    {/* Fill bar */}
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${fillPercent}%`,
                          background: isFull
                            ? '#ef4444'
                            : fillPercent > 70
                              ? '#f59e0b'
                              : '#22c55e',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            )
          })}

          {rooms.length === 0 && (
            <div className="py-20 text-center text-white/20">
              <p>جاري تحميل الغرف...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
