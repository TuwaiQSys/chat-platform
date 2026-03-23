import { useEffect, useState } from 'react'
import { Save, Plus, Trash2 } from 'lucide-react'

interface ChatConfig {
  messageColors: { normal: string; system: string; admin: string; broadcast: string; private: string }
  shortcuts: { code: string; text: string }[]
  wordFilter: { enabled: boolean; words: string[]; action: string; replacement: string }
  customEmoji: { code: string; name: string; url: string }[]
}

export default function ChatConfigPage() {
  const [config, setConfig] = useState<ChatConfig | null>(null)
  const [saving, setSaving] = useState('')
  const [saved, setSaved] = useState('')
  const [newWord, setNewWord] = useState('')
  const [newSC, setNewSC] = useState({ code: '', text: '' })
  const [newEmoji, setNewEmoji] = useState({ code: '', name: '', url: '' })
  const token = localStorage.getItem('token')
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetch('/api/admin/chat-config', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setConfig(d.config))
  }, [])

  const save = async (section: string, endpoint: string, body: any) => {
    setSaving(section)
    await fetch(`/api/admin/chat-config/${endpoint}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
    setSaving(''); setSaved(section); setTimeout(() => setSaved(''), 2000)
  }

  if (!config) return <div className="p-6 text-gray-400">جاري التحميل...</div>

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-white">إعدادات الدردشة</h1>

      {/* Message Colors */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <h3 className="text-sm font-bold text-white mb-3">ألوان الرسائل</h3>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(config.messageColors).map(([key, val]) => {
            const labels: Record<string, string> = { normal: 'رسالة عادية', system: 'رسالة نظام', admin: 'إعلان مسؤول', broadcast: 'بث', private: 'خاص' }
            return (
              <div key={key} className="flex items-center gap-2">
                <input type="color" value={val} onChange={e => setConfig({ ...config, messageColors: { ...config.messageColors, [key]: e.target.value } })}
                  className="h-8 w-12 rounded border border-gray-600 bg-gray-700 cursor-pointer" />
                <span className="text-xs text-gray-300">{labels[key] || key}</span>
                <div className="h-4 flex-1 rounded" style={{ background: val }} />
              </div>
            )
          })}
        </div>
        <button onClick={() => save('colors', 'colors', config.messageColors)} disabled={saving === 'colors'}
          className="mt-3 flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">
          <Save className="h-3 w-3" /> {saving === 'colors' ? '...' : 'حفظ الألوان'}
        </button>
        {saved === 'colors' && <span className="text-xs text-green-400 mr-2">✓</span>}
      </div>

      {/* Shortcuts */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <h3 className="text-sm font-bold text-white mb-3">الاختصارات</h3>
        <div className="space-y-1 mb-3">
          {config.shortcuts.map((sc, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="rounded bg-gray-700 px-2 py-0.5 text-blue-300 font-mono" dir="ltr">{sc.code}</span>
              <span className="text-gray-300">→</span>
              <span className="text-gray-300 flex-1">{sc.text}</span>
              <button onClick={() => setConfig({ ...config, shortcuts: config.shortcuts.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-300">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mb-2">
          <input value={newSC.code} onChange={e => setNewSC({ ...newSC, code: e.target.value })} placeholder="الرمز (مثل h1)" className="w-24 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white" dir="ltr" />
          <input value={newSC.text} onChange={e => setNewSC({ ...newSC, text: e.target.value })} placeholder="النص البديل..." className="flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white" dir="auto" />
          <button onClick={() => { if (newSC.code && newSC.text) { setConfig({ ...config, shortcuts: [...config.shortcuts, newSC] }); setNewSC({ code: '', text: '' }) } }}
            className="rounded bg-gray-600 px-2 py-1 text-xs text-white"><Plus className="h-3 w-3" /></button>
        </div>
        <button onClick={() => save('shortcuts', 'shortcuts', { shortcuts: config.shortcuts })} disabled={saving === 'shortcuts'}
          className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">
          <Save className="h-3 w-3" /> حفظ
        </button>
      </div>

      {/* Word Filter */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">فلتر الكلمات</h3>
          <button onClick={() => setConfig({ ...config, wordFilter: { ...config.wordFilter, enabled: !config.wordFilter.enabled } })}
            className={`rounded px-3 py-1 text-xs ${config.wordFilter.enabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-400'}`}>
            {config.wordFilter.enabled ? 'مفعّل' : 'معطّل'}
          </button>
        </div>
        <div className="flex gap-2 mb-2">
          <select value={config.wordFilter.action} onChange={e => setConfig({ ...config, wordFilter: { ...config.wordFilter, action: e.target.value } })}
            className="rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-gray-300">
            <option value="replace">استبدال</option>
            <option value="block">حظر الرسالة</option>
            <option value="flag">تعليم للمراجعة</option>
          </select>
          <input value={config.wordFilter.replacement} onChange={e => setConfig({ ...config, wordFilter: { ...config.wordFilter, replacement: e.target.value } })}
            placeholder="بديل (مثل ***)" className="w-20 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white" />
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {config.wordFilter.words.map((w, i) => (
            <span key={i} className="flex items-center gap-1 rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-300">
              {w}
              <button onClick={() => setConfig({ ...config, wordFilter: { ...config.wordFilter, words: config.wordFilter.words.filter((_, j) => j !== i) } })} className="text-red-400">✕</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 mb-2">
          <input value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newWord.trim()) { setConfig({ ...config, wordFilter: { ...config.wordFilter, words: [...config.wordFilter.words, newWord.trim()] } }); setNewWord('') } }}
            placeholder="كلمة محظورة..." className="flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white" dir="auto" />
          <button onClick={() => { if (newWord.trim()) { setConfig({ ...config, wordFilter: { ...config.wordFilter, words: [...config.wordFilter.words, newWord.trim()] } }); setNewWord('') } }}
            className="rounded bg-gray-600 px-2 py-1 text-xs text-white"><Plus className="h-3 w-3" /></button>
        </div>
        <button onClick={() => save('filter', 'word-filter', config.wordFilter)} disabled={saving === 'filter'}
          className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">
          <Save className="h-3 w-3" /> حفظ
        </button>
      </div>

      {/* Custom Emoji */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
        <h3 className="text-sm font-bold text-white mb-3">إيموجي مخصصة</h3>
        <div className="space-y-1 mb-3">
          {config.customEmoji.map((em, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="rounded bg-gray-700 px-2 py-0.5 text-blue-300 font-mono" dir="ltr">:{em.code}:</span>
              <span className="text-gray-300">{em.name}</span>
              <img src={em.url} alt={em.name} className="h-5 w-5" />
              <button onClick={() => setConfig({ ...config, customEmoji: config.customEmoji.filter((_, j) => j !== i) })} className="text-red-400 mr-auto">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mb-2">
          <input value={newEmoji.code} onChange={e => setNewEmoji({ ...newEmoji, code: e.target.value })} placeholder="الرمز" className="w-20 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white" dir="ltr" />
          <input value={newEmoji.name} onChange={e => setNewEmoji({ ...newEmoji, name: e.target.value })} placeholder="الاسم" className="w-24 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white" dir="auto" />
          <input value={newEmoji.url} onChange={e => setNewEmoji({ ...newEmoji, url: e.target.value })} placeholder="رابط الصورة..." className="flex-1 rounded border border-gray-600 bg-gray-700 px-2 py-1 text-xs text-white" dir="ltr" />
          <button onClick={() => { if (newEmoji.code && newEmoji.url) { setConfig({ ...config, customEmoji: [...config.customEmoji, newEmoji] }); setNewEmoji({ code: '', name: '', url: '' }) } }}
            className="rounded bg-gray-600 px-2 py-1 text-xs text-white"><Plus className="h-3 w-3" /></button>
        </div>
        <button onClick={() => save('emoji', 'emoji', { emoji: config.customEmoji })} disabled={saving === 'emoji'}
          className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">
          <Save className="h-3 w-3" /> حفظ
        </button>
      </div>
    </div>
  )
}
