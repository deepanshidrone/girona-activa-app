'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageSquare, CheckCircle2 } from 'lucide-react'
import { submitSessionFeedbackAction } from '@/app/actions/client-feedback'
import { COMMENT_MAX, PAIN_AREA_MAX, type MiFeedback } from '@/lib/client-portal/feedback'

type Props = {
  sourceId: string
  feedback: MiFeedback | null
  open: boolean            // dentro del plazo y la sesión lo admite
  closedReason?: string    // por qué no se puede (si !open)
  untilLabel: string       // "hasta el 13 nov"
}

// "Tu feedback" en el detalle de la sesión: dolor sí/no (+ zona) y comentario.
export function FeedbackSection({ sourceId, feedback, open, closedReason, untilLabel }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(!feedback && open)
  const [pain, setPain] = useState<boolean | null>(feedback?.pain ?? null)
  const [painArea, setPainArea] = useState(feedback?.pain_area ?? '')
  const [comment, setComment] = useState(feedback?.comment ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (pain === null) return setError('Indica si has tenido dolor.')
    setSaving(true)
    setError('')
    const result = await submitSessionFeedbackAction({ sourceId, pain, painArea, comment })
    setSaving(false)
    if (!result.ok) return setError(result.error)
    setSaved(true)
    setEditing(false)
    router.refresh()
  }

  // Sin feedback y fuera de plazo: no se muestra nada (salvo el motivo si aplica)
  if (!feedback && !open) {
    return closedReason ? <p className="text-xs text-white/35">{closedReason}</p> : null
  }

  return (
    <section id="feedback" className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4 scroll-mt-20">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-[var(--brand)]" />
        <h2 className="font-semibold">Tu feedback</h2>
      </div>

      {!editing && feedback ? (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            <span className="text-white/45">Dolor: </span>
            {feedback.pain
              ? <span className="text-red-300 font-medium">Sí{feedback.pain_area ? ` · ${feedback.pain_area}` : ''}</span>
              : <span className="text-green-400 font-medium">No</span>}
          </p>
          {feedback.comment && <p className="text-white/80 whitespace-pre-line">“{feedback.comment}”</p>}
          <p className="text-xs text-white/40 flex items-center gap-1.5">
            {feedback.read_by_staff && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
            {saved ? 'Enviado a tu entrenador.' : feedback.read_by_staff ? 'Tu entrenador lo ha leído.' : 'Pendiente de que lo lea tu entrenador.'}
          </p>
          {open && (
            <button type="button" onClick={() => { setEditing(true); setSaved(false) }}
              className="self-start text-sm text-[var(--brand)] py-2">
              Editar ({untilLabel})
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset>
            <legend className="text-sm text-white/70 mb-2">¿Has tenido dolor en esta sesión?</legend>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: false, label: 'No' }, { v: true, label: 'Sí' }].map(o => (
                <button key={o.label} type="button" onClick={() => setPain(o.v)} aria-pressed={pain === o.v}
                  className={`h-11 rounded-lg border text-sm font-medium transition-colors ${
                    pain === o.v
                      ? o.v ? 'border-red-400/60 bg-red-500/15 text-red-200' : 'border-green-400/60 bg-green-500/15 text-green-200'
                      : 'border-white/10 text-white/70 hover:bg-white/5'
                  }`}>
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          {pain && (
            <label className="flex flex-col gap-1 text-sm text-white/70">
              ¿Dónde? (opcional)
              <input value={painArea} onChange={e => setPainArea(e.target.value)} maxLength={PAIN_AREA_MAX}
                placeholder="Por ejemplo: rodilla derecha"
                className="rounded-lg bg-white text-[#1C1C1C] px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[var(--brand)]" />
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm text-white/70">
            Comentario para tu entrenador (opcional)
            <textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={COMMENT_MAX} rows={3}
              placeholder="¿Cómo te has sentido?"
              className="rounded-lg bg-white text-[#1C1C1C] px-3 py-2 text-base outline-none focus:ring-2 focus:ring-[var(--brand)] resize-none" />
          </label>

          {error && <p className="text-sm text-red-300">{error}</p>}

          <div className="flex gap-2">
            {feedback && (
              <button type="button" onClick={() => { setEditing(false); setError('') }}
                className="flex-1 h-11 rounded-lg border border-white/10 text-sm text-white/70">
                Cancelar
              </button>
            )}
            <button type="submit" disabled={saving}
              className="flex-1 h-11 rounded-lg bg-[var(--brand)] text-sm font-semibold text-white disabled:opacity-50">
              {saving ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
          <p className="text-xs text-white/35">Lo verá tu entrenador. Puedes cambiarlo {untilLabel}.</p>
        </form>
      )}
    </section>
  )
}
