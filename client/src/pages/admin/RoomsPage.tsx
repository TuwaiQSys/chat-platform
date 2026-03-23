import { useEffect, useState } from 'react'
import { Plus, Hash } from 'lucide-react'

interface RoomRecord {
  _id: string
  name: string
  description: string
  type: string
  status: string
  featured: boolean
  config: { maxMembers: number }
  memberCount: number
  createdAt: string
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<RoomRecord[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newMax, setNewMax] = useState(40)
  const token = localStorage.getItem('token')

  const fetchRooms = () => {
    fetch('/api/admin/rooms', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setRooms(data.rooms))
  }

  useEffect(() => { fetchRooms() }, [])

  const createRoom = async () => {
    if (!newName.trim()) return
    await fetch('/api/admin/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), maxMembers: newMax }),
    })
    setNewName('')
    setNewDesc('')
    setShowCreate(false)
    fetchRooms()
  }

  const toggleFeatured = async (roomId: string, featured: boolean) => {
    await fetch(`/api/admin/rooms/${roomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ featured }),
    })
    fetchRooms()
  }

  const updateStatus = async (roomId: string, status: string) => {
    await fetch(`/api/admin/rooms/${roomId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    })
    fetchRooms()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">الغرف ({rooms.length})</h1>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2 py-2 text-sm">
          <Plus className="h-4 w-4" />
          غرفة جديدة
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="glass rounded-xl p-4 mb-4 space-y-3 animate-fade-in">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="اسم الغرفة..." className="input-dark text-sm" dir="auto" autoFocus />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="وصف الغرفة..." className="input-dark text-sm" dir="auto" />
          <div className="flex items-center gap-3">
            <label className="text-xs text-white/40">الحد الأقصى:</label>
            <input type="number" value={newMax} onChange={(e) => setNewMax(Number(e.target.value))} className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white" />
            <button onClick={createRoom} className="btn-primary py-1.5 px-4 text-sm mr-auto">إنشاء</button>
          </div>
        </div>
      )}

      {/* Room list */}
      <div className="space-y-2">
        {rooms.map((room) => (
          <div key={room._id} className="glass rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600/10">
                <Hash className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <p className="font-medium text-white/80">{room.name}</p>
                <p className="text-xs text-white/25">{room.description || 'بدون وصف'} • {room.memberCount}/{room.config.maxMembers}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFeatured(room._id, !room.featured)}
                className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                  room.featured ? 'bg-amber-500/15 text-amber-400' : 'bg-white/5 text-white/25 hover:text-white/40'
                }`}
              >
                {room.featured ? '⭐ مميزة' : 'تمييز'}
              </button>
              <select
                value={room.status}
                onChange={(e) => updateStatus(room._id, e.target.value)}
                className={`rounded-md border px-2 py-1 text-xs ${
                  room.status === 'active' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : room.status === 'archived' ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400'
                  : 'border-red-500/20 bg-red-500/10 text-red-400'
                }`}
              >
                <option value="active">نشطة</option>
                <option value="archived">مؤرشفة</option>
                <option value="deleted">محذوفة</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
