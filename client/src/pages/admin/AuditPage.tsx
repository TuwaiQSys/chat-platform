import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface AuditEntry {
  _id: string
  actionType: string
  actorId: { nickname: string } | null
  targetId?: string
  targetType?: string
  roomId?: string
  reason?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const token = localStorage.getItem('token')

  useEffect(() => {
    fetch(`/api/admin/audit?page=${page}&limit=30`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { setLogs(data.logs); setPages(data.pages); setTotal(data.total) })
  }, [page])

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-white mb-6">سجل العمليات ({total})</h1>

      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-white/30">
              <th className="px-4 py-3 text-right font-medium">الوقت</th>
              <th className="px-4 py-3 text-right font-medium">الإجراء</th>
              <th className="px-4 py-3 text-right font-medium">بواسطة</th>
              <th className="px-4 py-3 text-right font-medium">السبب</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log._id} className="border-b border-white/[0.02]">
                <td className="px-4 py-2.5 text-white/25 text-xs" dir="ltr">
                  {new Date(log.createdAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="px-4 py-2.5">
                  <span className="rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/50">{log.actionType}</span>
                </td>
                <td className="px-4 py-2.5 text-white/50 text-xs">{log.actorId?.nickname || '—'}</td>
                <td className="px-4 py-2.5 text-white/30 text-xs">{log.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="btn-ghost p-1.5 disabled:opacity-20">
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="text-sm text-white/40">{page} / {pages}</span>
          <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages} className="btn-ghost p-1.5 disabled:opacity-20">
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
