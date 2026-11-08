'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Users, UserCheck, UserX, AlertTriangle } from 'lucide-react'
import {
  saveGroupAttendanceAction, saveGroupExerciseLogAction,
  type GroupClientRow, type GroupExercise, type GroupExerciseLog, type GroupSessionForLog,
} from '@/app/actions/group-session-logs'

const DIFFICULTY: Record<string, { label: string; className: string }> = {
  regression: { label: 'Regresión', className: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30' },
  base: { label: 'Base', className: 'bg-red-400/15 text-red-300 border-red-400/30' },
  progression: { label: 'Progresión', className: 'bg-green-400/15 text-green-400 border-green-400/30' },
}

function dateLabel(date: string) {
  const s = new Date(date + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function GroupSessionRunner({ session, isFuture }: { session: GroupSessionForLog; isFuture: boolean }) {
  const router = useRouter()
  const initial = Object.fromEntries(session.clients
    .filter(c => c.log && c.log.status !== 'in_progress')
    .map(c => [c.client_id, c.log!.status === 'completed']))
  const [attendance, setAttendance] = useState<Record<string, boolean>>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [openClient, setOpenClient] = useState<string | null>(null)

  const recorded = session.clients.some(c => c.log)
  const allMarked = session.clients.every(c => typeof attendance[c.client_id] === 'boolean')
  const dirty = session.clients.some(c => attendance[c.client_id] !== initial[c.client_id])
  const losingDetail = session.clients.filter(c =>
    attendance[c.client_id] === false && c.log?.status === 'completed' && c.log.exercise_logs.length > 0)
  const cancelled = session.status === 'cancelled'
  const time = session.session_time?.slice(0, 5)

  async function saveAttendance() {
    setSaving(true)
    setError('')
    setSavedMsg('')
    const r = await saveGroupAttendanceAction(session.id, attendance)
    setSaving(false)
    if (!r.ok) return setError(r.error)
    setSavedMsg(`Asistencia guardada: ${r.present} de ${r.total}.`)
    router.refresh()
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/hoy" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            {session.session_label && (
              <span className="w-7 h-7 rounded-full bg-[#FF914D] text-white text-sm font-bold flex items-center justify-center">
                {session.session_label}
              </span>
            )}
            <h1 className="text-xl font-bold text-white">Clase grupal</h1>
          </div>
          <p className="text-sm text-white/45 mt-0.5">
            {dateLabel(session.session_date)}{time ? ` · ${time}` : ''}{session.employee_name ? ` · ${session.employee_name}` : ''}
          </p>
        </div>
      </div>

      {cancelled ? (
        <Box><p className="text-sm text-white/50">Esta sesión está cancelada.</p></Box>
      ) : session.clients.length === 0 ? (
        <Box><p className="text-sm text-white/50">No hay clientes apuntados a esta sesión.</p></Box>
      ) : (
        <>
          {/* Paso 1: asistencia */}
          <Box>
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#FF914D]" />
                <h2 className="font-semibold text-white">1. Pasar lista</h2>
              </div>
              {!isFuture && (
                <button type="button"
                  onClick={() => setAttendance(Object.fromEntries(session.clients.map(c => [c.client_id, true])))}
                  className="text-sm text-white/50 hover:text-white">
                  Todos han venido
                </button>
              )}
            </div>
            <p className="text-xs text-white/40 mb-4">
              {isFuture ? 'Podrás pasar lista el día de la sesión.' : 'Marca quién ha venido. Es lo único obligatorio.'}
            </p>

            <ul className="flex flex-col gap-2">
              {session.clients.map(c => (
                <li key={c.client_id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{c.name}</p>
                    <span className={`inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${DIFFICULTY[c.difficulty].className}`}>
                      {DIFFICULTY[c.difficulty].label}
                    </span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <AttendanceButton active={attendance[c.client_id] === true} disabled={isFuture}
                      onClick={() => setAttendance(a => ({ ...a, [c.client_id]: true }))}
                      icon={<UserCheck className="h-4 w-4" />} label="Vino" tone="green" />
                    <AttendanceButton active={attendance[c.client_id] === false} disabled={isFuture}
                      onClick={() => setAttendance(a => ({ ...a, [c.client_id]: false }))}
                      icon={<UserX className="h-4 w-4" />} label="No vino" tone="red" />
                  </div>
                </li>
              ))}
            </ul>

            {losingDetail.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-yellow-300 mt-3">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Se borrará el detalle ya registrado de: {losingDetail.map(c => c.name).join(', ')}.
              </p>
            )}
            {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
            {savedMsg && !dirty && <p className="text-sm text-green-400 mt-3">{savedMsg}</p>}

            {!isFuture && (
              <button type="button" onClick={saveAttendance} disabled={!allMarked || saving || (recorded && !dirty)}
                className="mt-4 w-full h-11 rounded-lg bg-[#FF914D] hover:bg-[#e07a3a] text-white text-sm font-semibold disabled:opacity-40 transition-colors">
                {saving ? 'Guardando…' : recorded ? (dirty ? 'Guardar cambios de asistencia' : 'Asistencia guardada') : 'Guardar asistencia'}
              </button>
            )}
          </Box>

          {/* Paso 2: detalle opcional */}
          {session.clients.some(c => c.log?.status === 'completed') && (
            <div className="mt-6">
              <h2 className="font-semibold text-white mb-1">2. Detalle por cliente <span className="text-white/40 font-normal text-sm">(opcional)</span></h2>
              <p className="text-xs text-white/40 mb-3">Series, repeticiones, carga, RPE y RIR de cada asistente. Se guarda ejercicio a ejercicio.</p>
              <div className="flex flex-col gap-2">
                {session.clients.filter(c => c.log?.status === 'completed').map(c => (
                  <ClientDetail key={c.client_id} client={c}
                    exercises={session.exercises[c.difficulty]}
                    open={openClient === c.client_id}
                    onToggle={() => setOpenClient(o => (o === c.client_id ? null : c.client_id))} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Box({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5">{children}</div>
}

function AttendanceButton({ active, disabled, onClick, icon, label, tone }: {
  active: boolean; disabled: boolean; onClick: () => void; icon: React.ReactNode; label: string; tone: 'green' | 'red'
}) {
  const on = tone === 'green' ? 'border-green-400/50 bg-green-500/15 text-green-300' : 'border-red-400/50 bg-red-500/15 text-red-300'
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={active}
      className={`flex items-center gap-1 h-9 px-2.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 ${
        active ? on : 'border-white/10 text-white/50 hover:bg-white/5'}`}>
      {icon}<span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function ClientDetail({ client, exercises, open, onToggle }: {
  client: GroupClientRow; exercises: GroupExercise[]; open: boolean; onToggle: () => void
}) {
  const logs = client.log?.exercise_logs ?? []
  const done = exercises.filter(e => logs.some(l => l.exercise_id === e.exercise_id)).length
  return (
    <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 overflow-hidden">
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium truncate">{client.name}</p>
          <p className="text-xs text-white/40">
            {DIFFICULTY[client.difficulty].label} · {exercises.length ? `${done}/${exercises.length} ejercicios registrados` : 'sin ejercicios en este bloque'}
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
      </button>
      {open && (
        <div className="border-t border-white/5 px-4 py-3 flex flex-col gap-3">
          {exercises.length === 0 ? (
            <p className="text-sm text-white/40">El bloque no tiene ejercicios para esta dificultad. Añádelos en el ciclo.</p>
          ) : exercises.map(e => (
            <ExerciseForm key={e.gse_id} sessionLogId={client.log!.id} exercise={e}
              existing={logs.find(l => l.exercise_id === e.exercise_id) ?? null} />
          ))}
        </div>
      )}
    </div>
  )
}

function ExerciseForm({ sessionLogId, exercise, existing }: {
  sessionLogId: string; exercise: GroupExercise; existing: GroupExerciseLog | null
}) {
  const str = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))
  const [f, setF] = useState({
    sets: existing ? str(existing.sets_done) : str(exercise.sets),
    reps: existing ? str(existing.reps_done) : str(exercise.reps),
    kg: existing ? str(existing.load_kg) : str(exercise.weight_kg),
    rpe: str(existing?.rpe), rir: str(existing?.rir), notes: existing?.notes ?? '',
    skipped: !!existing?.skipped,
  })
  const [saved, setSaved] = useState(!!existing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof f, v: string | boolean) => { setF(p => ({ ...p, [k]: v })); setSaved(false) }
  const num = (v: string, dec = false) => (v.trim() === '' ? null : dec ? parseFloat(v.replace(',', '.')) : parseInt(v, 10))

  async function save() {
    setBusy(true)
    setError('')
    const r = await saveGroupExerciseLogAction(sessionLogId, {
      exercise_id: exercise.exercise_id,
      sets_done: num(f.sets), reps_done: num(f.reps), load_kg: num(f.kg, true),
      rpe: num(f.rpe), rir: num(f.rir), notes: f.notes, skipped: f.skipped,
    })
    setBusy(false)
    if (!r.ok) return setError(r.error)
    setSaved(true)
  }

  const input = 'w-full h-10 rounded-lg bg-white text-[#1C1C1C] px-2 text-sm text-center outline-none focus:ring-2 focus:ring-[#FF914D] disabled:opacity-40'
  return (
    <div className={`rounded-xl border p-3 ${saved ? 'border-green-500/25 bg-green-500/[0.04]' : 'border-white/10'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm text-white font-medium">{exercise.name}</p>
        {saved && <Check className="h-4 w-4 text-green-400 shrink-0" />}
      </div>
      <p className="text-xs text-white/40 mb-2">
        Plan: {[exercise.sets && exercise.reps ? `${exercise.sets}×${exercise.reps}` : null, exercise.weight_kg ? `${exercise.weight_kg} kg` : null].filter(Boolean).join(' · ') || '—'}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {([['sets', 'Series'], ['reps', 'Reps'], ['kg', 'Kg'], ['rpe', 'RPE'], ['rir', 'RIR']] as const).map(([k, label]) => (
          <label key={k} className="flex flex-col gap-1 text-[11px] text-white/45 text-center">
            {label}
            <input inputMode={k === 'kg' ? 'decimal' : 'numeric'} value={f[k]} disabled={f.skipped}
              onChange={e => set(k, e.target.value)} className={input} />
          </label>
        ))}
      </div>
      <input value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Nota interna (opcional)"
        className="mt-2 w-full h-10 rounded-lg bg-white text-[#1C1C1C] px-3 text-sm outline-none focus:ring-2 focus:ring-[#FF914D]" />
      <div className="flex items-center justify-between gap-3 mt-2">
        <label className="flex items-center gap-2 text-xs text-white/60">
          <input type="checkbox" checked={f.skipped} onChange={e => set('skipped', e.target.checked)} className="accent-[#FF914D]" />
          Saltado
        </label>
        <button type="button" onClick={save} disabled={busy || saved}
          className="h-9 px-4 rounded-lg bg-[#FF914D] hover:bg-[#e07a3a] text-white text-xs font-semibold disabled:opacity-40">
          {busy ? 'Guardando…' : saved ? 'Guardado' : 'Guardar'}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  )
}
