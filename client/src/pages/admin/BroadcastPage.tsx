import { useEffect, useState } from 'react'
import { Megaphone, Send } from 'lucide-react'
import { socket } from '@/lib/socket'

interface RoomRecord { id: string; name: string }

export default function BroadcastPage() {
  const [rooms, setRooms] = useState<RoomRecord[]>([])
  const [mode, setMode] = useState<'global' | 'room'>('global')
  const [selectedRoom, setSelectedRoom] = useState('')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const token = localStorage.getItem('token')

  useEffect(() => {
    fetch('/api/admin/rooms', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setRooms(d.rooms.map((r: any) => ({ id: r._id || r.id, name: r.name }))))
  }, [])

  const sendBroadcast = () => {
    if (!content.trim() || sending) return
    setSending(true)

    socket.emit('broadcast:send', {
      content: content.trim(),
      roomId: mode === 'room' ? selectedRoom : undefined,
    }, (res: any) => {
      setSending(false)
      if (res.error) return alert(res.error)
      setSent(true)
      setContent('')
      setTimeout(() => setSent(false), 3000)
    })
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-6">البث والإعلانات</h1>

      <div className="max-w-lg">
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-blue-400" />
            <span className="text-sm font-bold text-white">إرسال بث</span>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('global')}
              className={`rounded px-3 py-1.5 text-sm ${mode === 'global' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
            >
              بث عام (الجميع)
            </button>
            <button
              onClick={() => setMode('room')}
              className={`rounded px-3 py-1.5 text-sm ${mode === 'room' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
            >
              بث لغرفة محددة
            </button>
          </div>

          {mode === 'room' && (
            <select
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white"
            >
              <option value="">اختر غرفة...</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          )}

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="اكتب نص البث..."
            rows={3}
            className="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white resize-none focus:border-blue-500 focus:outline-none"
            dir="auto"
          />

          <button
            onClick={sendBroadcast}
            disabled={!content.trim() || sending || (mode === 'room' && !selectedRoom)}
            className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            {sending ? 'جاري الإرسال...' : 'إرسال البث'}
          </button>

          {sent && <p className="text-sm text-green-400 animate-fade-in">تم إرسال البث بنجاح ✓</p>}
        </div>
      </div>
    </div>
  )
}
