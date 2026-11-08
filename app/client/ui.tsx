import Link from 'next/link'
import { Info } from 'lucide-react'
import {
  STATUS_LABEL, formatPrescription, formatTimeRange, sessionTypeLabel, DIFFICULTY_LABEL,
  type MiEjercicio, type MiSesion, type SessionStatus,
} from '@/lib/client-portal/types'

// Piezas visuales compartidas de la vista de cliente (Server Components).

export function EmptyState({ title, text, icon = '📅' }: { title: string; text: string; icon?: string }) {
  return (
    <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-6 text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-3 text-2xl">
        {icon}
      </div>
      <h2 className="font-semibold mb-1">{title}</h2>
      <p className="text-sm text-white/50">{text}</p>
    </div>
  )
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand)]/10 px-3.5 py-3 text-sm text-white/85 mb-4">
      <Info className="h-4 w-4 text-[var(--brand)] shrink-0 mt-0.5" />
      <div>{children}</div>
    </div>
  )
}

const STATUS_STYLE: Record<SessionStatus, string> = {
  scheduled: 'bg-[var(--brand)]/15 text-[var(--brand)]',
  completed: 'bg-green-500/15 text-green-400',
  missed: 'bg-red-500/15 text-red-300',
  cancelled: 'bg-white/5 text-white/40 line-through',
  unrecorded: 'bg-white/5 text-white/45',
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}

// Tarjeta de sesión con sus ejercicios (Hoy / próxima sesión).
export function SessionCard({ sesion, ejercicios }: { sesion: MiSesion; ejercicios: MiEjercicio[] }) {
  const time = formatTimeRange(sesion.session_time, sesion.duration_min)
  return (
    <Link
      href={`/client/sesion/${sesion.source_id}`}
      className="block bg-[#1C1C1C] rounded-2xl border border-white/10 p-4 active:bg-white/5 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-semibold">
          {time && <span>{time} · </span>}
          {sessionTypeLabel(sesion)}
        </p>
        {sesion.status !== 'scheduled' && <StatusBadge status={sesion.status} />}
      </div>
      <p className="text-xs text-white/45 mb-3">
        {sesion.trainer_name ? `Con ${sesion.trainer_name}` : 'Entrenador por asignar'}
        {sesion.type === 'group' && sesion.difficulty ? ` · Tu nivel: ${DIFFICULTY_LABEL[sesion.difficulty]}` : ''}
      </p>

      {ejercicios.length === 0 ? (
        <p className="text-sm text-white/40">Tu entrenador todavía no ha añadido los ejercicios.</p>
      ) : (
        <ul className="divide-y divide-white/5 rounded-xl bg-white/[0.03] border border-white/5">
          {ejercicios.map(e => (
            <li key={e.planned_id} className="px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm">{e.exercise_name}</span>
                <span className="text-xs text-white/55 whitespace-nowrap">{formatPrescription(e.sets, e.reps, e.weight_kg)}</span>
              </div>
              {e.instructions && <p className="text-xs text-white/45 italic mt-0.5">“{e.instructions}”</p>}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[var(--brand)] mt-3 text-right">Ver detalle →</p>
    </Link>
  )
}
