import { notFound } from 'next/navigation'
import { Info } from 'lucide-react'
import { getEjercicios, getPortal, getRegistro, getSesion } from '@/lib/client-portal/data'
import {
  DIFFICULTY_LABEL, capitalizeFirst, formatKg, formatPrescription, formatTimeRange, sessionTypeLabel,
  type MiEjercicio, type MiRegistroEjercicio,
} from '@/lib/client-portal/types'
import { formatDateEs } from '@/lib/center'
import { StatusBadge } from '../../ui'
import { BackButton } from './back-button'

export const dynamic = 'force-dynamic'

// Detalle de sesión: ejercicios previstos y, si está registrada, lo hecho.
// Aquí irá el feedback del cliente (docs/spec-vista-cliente.md §4.1.3, punto 5 del §9).
export default async function ClientSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const portal = await getPortal()
  if (!portal?.ficha) return null

  const sesion = await getSesion(id)
  if (!sesion) notFound()

  const [ejercicios, log] = await Promise.all([getEjercicios([id]), getRegistro(id)])
  const { rows, extras } = matchLogs(ejercicios, log?.ejercicios ?? [])
  const time = formatTimeRange(sesion.session_time, sesion.duration_min)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <BackButton />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold">
              {capitalizeFirst(formatDateEs(sesion.session_date, { weekday: 'long', day: 'numeric', month: 'short' }))}
            </h1>
            <StatusBadge status={sesion.status} />
          </div>
          <p className="text-sm text-white/55">
            {[time, sessionTypeLabel(sesion), sesion.trainer_name].filter(Boolean).join(' · ')}
          </p>
          {sesion.type === 'group' && sesion.difficulty && (
            <p className="text-xs text-white/40 mt-0.5">Tu nivel: {DIFFICULTY_LABEL[sesion.difficulty]}</p>
          )}
        </div>
      </div>

      {sesion.status === 'unrecorded' && (
        <p className="text-sm text-white/45">Tu entrenador no registró la asistencia de esta sesión.</p>
      )}

      {rows.length === 0 && extras.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5 text-sm text-white/45">
          Tu entrenador todavía no ha añadido los ejercicios de esta sesión.
        </div>
      ) : (
        <ul className="bg-[#1C1C1C] rounded-2xl border border-white/10 divide-y divide-white/5">
          {rows.map(({ planned, done }) => (
            <li key={planned.planned_id} className="p-4">
              <p className="font-medium mb-1.5">{planned.exercise_name}</p>
              <Line label="Plan" value={formatPrescription(planned.sets, planned.reps, planned.weight_kg) || '—'} />
              {log && <Line label="Hecho" value={done ? formatDone(done) : 'Sin registrar'} highlight={!!done && !done.skipped} />}
              {planned.instructions && (
                <p className="flex items-start gap-1.5 text-xs text-white/50 mt-2">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
                  <span>{planned.instructions}</span>
                </p>
              )}
            </li>
          ))}
          {extras.map(done => (
            <li key={done.id} className="p-4">
              <p className="font-medium mb-1.5">{done.exercise_name ?? 'Ejercicio'}</p>
              <Line label="Hecho" value={formatDone(done)} highlight={!done.skipped} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Line({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <p className="text-sm flex gap-3">
      <span className="w-12 shrink-0 text-white/40">{label}</span>
      <span className={highlight ? 'text-green-400' : 'text-white/75'}>{value}</span>
    </p>
  )
}

function formatDone(l: MiRegistroEjercicio): string {
  if (l.skipped) return 'Saltado'
  const parts = [formatPrescription(l.sets_done, l.reps_done, null)]
  if (l.load_kg) parts.push(`${formatKg(l.load_kg)} kg`)
  if (l.rpe != null) parts.push(`RPE ${l.rpe}`)
  if (l.rir != null) parts.push(`RIR ${l.rir}`)
  return parts.filter(Boolean).join(' · ') || 'Hecho'
}

// Empareja lo registrado con lo previsto: en individuales por plan_exercise_id;
// en grupales (sin plan_exercise_id) por ejercicio. Lo que no encaja se muestra aparte.
function matchLogs(planned: MiEjercicio[], logs: MiRegistroEjercicio[]) {
  const used = new Set<string>()
  const rows = planned.map(p => {
    const done = logs.find(l => !used.has(l.id) && l.plan_exercise_id === p.planned_id)
      ?? logs.find(l => !used.has(l.id) && !l.plan_exercise_id && l.exercise_id === p.exercise_id)
    if (done) used.add(done.id)
    return { planned: p, done }
  })
  return { rows, extras: logs.filter(l => !used.has(l.id)) }
}
