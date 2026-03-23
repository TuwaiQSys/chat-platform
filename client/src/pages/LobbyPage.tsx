import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, Hash, LogOut, Wifi, Plus, X } from 'lucide-react'
import { socket } from '@/lib/socket'
import { useStore, type ChatRoom } from '@/hooks/useStore'

export default function LobbyPage() {
  const { user, rooms, setRooms, onlineCount, setOnlineCount, setUser, setCurrentRoom, setMessages, setMembers } = useStore()
  const [showCreate, setShowCreate] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDesc, setNewRoomDesc] = useState('')
  const [createError, setCreateError] = useState('')
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

  const handleCreateRoom = () => {
    const name = newRoomName.trim()
    if (!name) return setCreateError('اسم الغرفة مطلوب')

    socket.emit('room:create', { name, description: newRoomDesc.trim() }, (res: any) => {
      if (res.error) return setCreateError(res.error)
      setShowCreate(false)
      setNewRoomName('')
      setNewRoomDesc('')
      setCreateError('')
    })
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    socket.disconnect()
    setUser(null)
    setCurrentRoom(null)
    setMessages([])
    setMembers([])
    navigate('/')
  }

  // Show create button for non-guest users (permission checked server-side)
  const canShowCreate = user?.type !== 'guest'

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
        <div className="flex items-center gap-2">
          {user?.badge && <span className="text-sm">{user.badge}</span>}
          <span className="text-sm" style={{ color: (user as any)?.nicknameColor || 'rgba(255,255,255,0.4)' }}>
            {user?.nickname}
          </span>
          {user?.type === 'admin' && (
            <button onClick={() => navigate('/admin')} className="btn-ghost py-1 px-2 text-xs text-indigo-400">
              لوحة التحكم
            </button>
          )}
          <button onClick={handleLogout} className="btn-ghost p-2" title="خروج">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-lg space-y-2">
          {/* Create room button */}
          {canShowCreate && (
            <div className="mb-3">
              {!showCreate ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="glass glass-hover flex w-full items-center justify-center gap-2 rounded-xl p-3 text-sm text-white/40 hover:text-indigo-300 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  إنشاء غرفة جديدة
                </button>
              ) : (
                <div className="glass rounded-xl p-4 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white/60">غرفة جديدة</span>
                    <button onClick={() => { setShowCreate(false); setCreateError('') }} className="p-1 text-white/30 hover:text-white/60">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    value={newRoomName}
                    onChange={(e) => { setNewRoomName(e.target.value); setCreateError('') }}
                    placeholder="اسم الغرفة..."
                    className="input-dark text-sm"
                    dir="auto"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateRoom()}
                  />
                  <input
                    value={newRoomDesc}
                    onChange={(e) => setNewRoomDesc(e.target.value)}
                    placeholder="وصف الغرفة (اختياري)..."
                    className="input-dark text-sm"
                    dir="auto"
                  />
                  {createError && <p className="text-xs text-red-400">{createError}</p>}
                  <button onClick={handleCreateRoom} className="btn-primary w-full py-2 text-sm">إنشاء</button>
                </div>
              )}
            </div>
          )}

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
                    <div className="h-1 w-16 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${fillPercent}%`,
                          background: isFull ? '#ef4444' : fillPercent > 70 ? '#f59e0b' : '#22c55e',
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
