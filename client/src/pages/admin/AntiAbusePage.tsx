import { useEffect, useState } from 'react'
import { ShieldAlert, Save } from 'lucide-react'

interface Config {
  globalFloodLimit: number
  globalFloodWindowSeconds: number
  globalSlowModeSeconds: number
  duplicateMessageWindow: number
  maxMessageLength: number
  spamScoreThreshold: number
  autoMuteOnSpam: boolean
  autoMuteDuration: number
}

export default function AntiAbusePage() {
  const [config, setConfig] = useState<Config | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const token = localStorage.getItem('token')

  useEffect(() => {
    fetch('/api/admin/anti-abuse', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => setConfig(d.config))
  }, [])

  const save = async () => {
    if (!config) return
    setSaving(true)
    await fetch('/api/admin/anti-abuse', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(config),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (!config) return <div className="p-6 text-gray-400">جاري التحميل...</div>

  const Field = ({ label, field, type = 'number' }: { label: string; field: keyof Config; type?: string }) => (
    <div className="flex items-center justify-between rounded bg-gray-700/50 px-4 py-3">
      <label className="text-sm text-gray-300">{label}</label>
      {type === 'toggle' ? (
        <button
          onClick={() => setConfig({ ...config, [field]: !config[field] })}
          className={`rounded px-3 py-1 text-xs font-bold ${config[field] ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-400'}`}
        >
          {config[field] ? 'مفعّل' : 'معطّل'}
        </button>
      ) : (
        <input
          type="number"
          value={config[field] as number}
          onChange={(e) => setConfig({ ...config, [field]: Number(e.target.value) })}
          className="w-24 rounded border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-white text-center"
        />
      )}
    </div>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          <h1 className="text-xl font-bold text-white">مكافحة الإساءة</h1>
        </div>
        <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-40">
          <Save className="h-4 w-4" />
          {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>

      {saved && <p className="text-sm text-green-400 mb-4 animate-fade-in">تم حفظ الإعدادات ✓</p>}

      <div className="max-w-lg space-y-2">
        <h3 className="text-sm font-bold text-gray-400 mb-2">الفيضان والسبام</h3>
        <Field label="حد الرسائل (عدد)" field="globalFloodLimit" />
        <Field label="نافذة الفيضان (ثانية)" field="globalFloodWindowSeconds" />
        <Field label="الوضع البطيء (ثانية بين الرسائل)" field="globalSlowModeSeconds" />

        <h3 className="text-sm font-bold text-gray-400 mt-4 mb-2">حماية المحتوى</h3>
        <Field label="نافذة كشف التكرار (ثانية)" field="duplicateMessageWindow" />
        <Field label="أقصى طول رسالة" field="maxMessageLength" />
        <Field label="حد نقاط السبام" field="spamScoreThreshold" />

        <h3 className="text-sm font-bold text-gray-400 mt-4 mb-2">الإجراءات التلقائية</h3>
        <Field label="كتم تلقائي عند السبام" field="autoMuteOnSpam" type="toggle" />
        <Field label="مدة الكتم التلقائي (دقائق)" field="autoMuteDuration" />
      </div>
    </div>
  )
}
