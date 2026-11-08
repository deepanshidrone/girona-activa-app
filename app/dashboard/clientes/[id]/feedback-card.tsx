'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, AlertTriangle } from 'lucide-react'
import { markClientFeedbackReadAction, type StaffFeedback } from '@/app/actions/client-feedback'

function fmt(date: string | null) {
  if (!date) return '—'
  return new Date(date.length === 10 ? date + 'T12:00:00Z' : date)
    .toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Madrid' })
}

// Feedback del cliente en su ficha (docs/spec-vista-cliente.md §4.2).
// El dolor se resalta; lo no leído lleva la etiqueta "Nuevo".
export function FeedbackCard({ clientId, items }: { clientId: string; items: StaffFeedback[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const unread = items.filter(i => !i.read_at).length

  async function markRead() {
    setLoading(true)
    setError('')
    const result = await markClientFeedbackReadAction(clientId)
    setLoading(false)
    if (!result.ok) return setError(result.error)
    router.refresh()
  }

  return (
    <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-white/40" />
          <h2 className="font-semibold text-white">Feedback del cliente</h2>
          {unread > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#FF914D]/15 text-[#FF914D]">{unread} sin leer</span>
          )}
        </div>
        {unread > 0 && (
          <button onClick={markRead} disabled={loading}
            className="text-sm font-medium text-white/50 hover:text-white transition-colors disabled:opacity-50">
            {loading ? 'Marcando…' : 'Marcar como leído'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-white/40">
          Todavía no hay feedback. El cliente puede dejarlo desde la app tras cada sesión, si tiene acceso.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map(f => (
            <li key={f.id} className={`rounded-xl p-3 border ${
              f.pain ? 'border-red-500/30 bg-red-500/10' : 'border-white/5 bg-white/5'
            }`}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-white/50">{fmt(f.session_date)} · {f.session_label}</span>
                {!f.read_at && <span className="font-medium text-[#FF914D]">Nuevo</span>}
              </div>
              <p className="text-sm mt-1">
                {f.pain ? (
                  <span className="inline-flex items-center gap-1 font-medium text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5" /> Dolor{f.pain_area ? `: ${f.pain_area}` : ''}
                  </span>
                ) : (
                  <span className="text-green-400 font-medium">Sin dolor</span>
                )}
              </p>
              {f.comment && <p className="text-sm text-white/75 mt-1 whitespace-pre-line">“{f.comment}”</p>}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}
