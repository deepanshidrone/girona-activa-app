'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Activity, UserMinus, UserPlus } from 'lucide-react'
import { deactivateClientAction, reactivateClientAction } from '@/app/actions/client-status'
import { CLIENT_STATE_BADGE, CLIENT_STATE_LABEL, type ClientState } from '@/lib/client-state'
import { formatDateEs } from '@/lib/center'

export type PeriodRow = {
  id: string
  started_on: string
  ended_on: string | null
  reason: string | null
  notes: string | null
}

export type EndReason = { id: string; label: string; requires_notes: boolean }

type Props = {
  clientId: string
  state: ClientState
  today: string
  periods: PeriodRow[]          // del más reciente al más antiguo
  reasons: EndReason[]
  canChange: boolean
}

const fieldClass = 'w-full rounded-lg bg-white text-[#1C1C1C] text-sm px-3 py-2 border border-white/10'

export function StatusCard({ clientId, state, today, periods, reasons, canChange }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'baja' | 'reactivar'>('view')
  const [date, setDate] = useState(today)
  const [reasonId, setReasonId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reason = reasons.find(r => r.id === reasonId)
  const current = periods[0]

  function reset() {
    setMode('view')
    setDate(today)
    setReasonId('')
    setNotes('')
    setError('')
  }

  async function submit() {
    setLoading(true)
    setError('')
    const result = mode === 'baja'
      ? await deactivateClientAction({ clientId, date, reasonId, notes })
      : await reactivateClientAction({ clientId, date })
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    reset()
    router.refresh()
  }

  return (
    <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-white/40" />
        <h2 className="font-semibold text-white">Estado</h2>
        <span className={`ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CLIENT_STATE_BADGE[state]}`}>
          {CLIENT_STATE_LABEL[state]}
        </span>
      </div>

      <p className="text-xs text-white/40 mb-3">
        {state === 'active' && 'De alta y con un plan vigente.'}
        {state === 'inactive' && 'De alta, pero sin plan vigente.'}
        {state === 'baja' && current?.ended_on && `De baja desde el ${formatDateEs(current.ended_on)}${current.reason ? ` · ${current.reason}` : ''}.`}
      </p>

      {state === 'inactive' && mode === 'view' && (
        <Link href={`/dashboard/planes/nuevo?client=${clientId}`} className="block text-sm font-medium text-[#FF914D] hover:underline mb-3">
          + Crear plan
        </Link>
      )}

      {canChange && mode === 'view' && (
        state === 'baja' ? (
          <button
            onClick={() => setMode('reactivar')}
            className="flex items-center gap-1.5 text-sm font-medium text-[#FF914D] hover:underline"
          >
            <UserPlus className="h-4 w-4" />
            Reactivar
          </button>
        ) : (
          <button
            onClick={() => setMode('baja')}
            className="flex items-center gap-1.5 text-sm font-medium text-white/50 hover:text-white transition-colors"
          >
            <UserMinus className="h-4 w-4" />
            Dar de baja
          </button>
        )
      )}

      {mode !== 'view' && (
        <div className="flex flex-col gap-3 mt-1">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-white/50">
              {mode === 'baja' ? 'Fecha de baja' : 'Fecha de reactivación'}
            </span>
            <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className={fieldClass} />
          </label>

          {mode === 'baja' && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/50">Motivo</span>
                <select value={reasonId} onChange={e => setReasonId(e.target.value)} className={fieldClass}>
                  <option value="">Elige un motivo…</option>
                  {reasons.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-white/50">
                  Comentario{reason?.requires_notes ? '' : ' (opcional)'}
                </span>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={fieldClass} />
              </label>
              <p className="text-xs text-white/40">
                Se cancela el plan vigente y se quitan las sesiones posteriores a la fecha de baja. El historial no se borra.
              </p>
            </>
          )}

          {mode === 'reactivar' && (
            <p className="text-xs text-white/40">
              El cliente vuelve de alta como Inactivo hasta que tenga un plan.
            </p>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={loading || (mode === 'baja' && (!reasonId || (reason?.requires_notes && !notes.trim())))}
              className="text-sm font-medium text-white bg-[#FF914D] hover:bg-[#e07a3a] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando…' : mode === 'baja' ? 'Confirmar baja' : 'Reactivar'}
            </button>
            <button onClick={reset} className="text-sm font-medium text-white/40 hover:text-white px-3 py-1.5">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {periods.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs font-medium text-white/40 mb-2">Historial de altas y bajas</p>
          <ul className="flex flex-col gap-2">
            {periods.map(p => (
              <li key={p.id} className="text-xs text-white/70">
                <span className="text-white">{formatDateEs(p.started_on)}</span>
                {' → '}
                {p.ended_on ? <span className="text-white">{formatDateEs(p.ended_on)}</span> : <span className="text-green-400">actual</span>}
                {p.reason && <span className="text-white/40"> · {p.reason}</span>}
                {p.notes && <p className="text-white/40 mt-0.5">{p.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
