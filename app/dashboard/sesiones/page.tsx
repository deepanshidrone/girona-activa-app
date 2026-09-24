import { getGroupCyclesAction } from '@/app/actions/group-sessions'
import { Plus, CalendarDays, Dumbbell, Zap } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Fixed 2-week session pattern (start_date = Monday of week 1)
// Week 1: Mon=A, Tue=A, Wed=B, Thu=B, Fri=C
// Week 2: Mon=B, Tue=B, Wed=B, Thu=B, Fri=A
const CYCLE_PATTERN: ('A' | 'B' | 'C')[][] = [
  ['A', 'A', 'B', 'B', 'C'],
  ['B', 'B', 'B', 'B', 'A'],
]
const DAY_LABELS = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv']
const SESSION_COLORS = { A: '#FF914D', B: '#60a5fa', C: '#c084fc' }

function getCycleDays(startDate: string) {
  const start = new Date(startDate + 'T12:00:00')
  return CYCLE_PATTERN.map((week, wi) =>
    week.map((session, di) => {
      const d = new Date(start)
      d.setDate(start.getDate() + wi * 7 + di)
      return { date: d, session, dayLabel: DAY_LABELS[di] }
    })
  )
}

function CycleCalendar({ startDate }: { startDate: string }) {
  const weeks = getCycleDays(startDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="flex flex-col gap-1.5">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex items-center gap-1.5">
            <span className="text-[10px] text-white/25 w-14 shrink-0 font-medium">Setmana {wi + 1}</span>
            <div className="flex gap-1.5 flex-1">
              {week.map(({ date, session, dayLabel }, di) => {
                const isToday = date.toDateString() === today.toDateString()
                const isPast = date < today && !isToday
                const color = SESSION_COLORS[session]
                return (
                  <div key={di} className="flex-1 flex flex-col items-center gap-0.5 rounded-lg py-1.5 px-1"
                    style={{ background: isToday ? `${color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${isToday ? color + '40' : 'rgba(255,255,255,0.06)'}` }}
                  >
                    <span className="text-[9px] font-semibold tracking-wider uppercase"
                      style={{ color: isPast ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.4)' }}>
                      {dayLabel}
                    </span>
                    <span className="text-[11px] font-medium tabular-nums"
                      style={{ color: isPast ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.55)' }}>
                      {date.getDate()}
                    </span>
                    <span className="text-[10px] font-bold" style={{ color: isPast ? 'rgba(255,255,255,0.2)' : color }}>
                      {session}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function getCycleStatus(startDate: string): { label: string; color: string } {
  const start = new Date(startDate)
  const end = new Date(startDate)
  end.setDate(end.getDate() + 14)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (today < start) return { label: 'Próximo', color: 'text-blue-400 bg-blue-400/10' }
  if (today >= start && today < end) return { label: 'Activo', color: 'text-green-400 bg-green-400/10' }
  return { label: 'Expirado', color: 'text-white/30 bg-white/5' }
}

function formatDateRange(startDate: string) {
  const start = new Date(startDate)
  const end = new Date(startDate)
  end.setDate(end.getDate() + 13)
  const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
  return `${fmt(start)} — ${fmt(end)}`
}

const DIFFICULTY_META = {
  regression:  { label: 'Regresión',  short: 'Reg',  color: 'text-blue-400',   dot: 'bg-blue-400'   },
  base:        { label: 'Base',       short: 'Base', color: 'text-[#FF914D]',  dot: 'bg-[#FF914D]'  },
  progression: { label: 'Progresión', short: 'Prog', color: 'text-purple-400', dot: 'bg-purple-400' },
} as const

const LEVEL_LABELS = {
  regression:  'Nivel 1 (Groc)',
  base:        'Nivel 2 (Blau)',
  progression: 'Nivel 3 (Vermell)',
} as const

export default async function SesionesPage() {
  const { cycles } = await getGroupCyclesAction()

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sesiones grupales</h1>
          <p className="text-white/50 text-sm mt-0.5">Ciclos de 2 semanas · 3 sesiones × 3 dificultades</p>
        </div>
        <Link
          href="/dashboard/sesiones/nuevo"
          className="flex items-center gap-2 bg-[#FF914D] hover:bg-[#e07a3a] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo ciclo
        </Link>
      </div>

      {/* Leyenda niveles */}
      <div className="flex items-center gap-4 mb-5 text-xs text-white/40">
        {(Object.entries(DIFFICULTY_META) as [keyof typeof DIFFICULTY_META, typeof DIFFICULTY_META[keyof typeof DIFFICULTY_META]][]).map(([key, meta]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
            <span>{meta.label} — {LEVEL_LABELS[key]}</span>
          </div>
        ))}
      </div>

      {cycles.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-12 text-center">
          <CalendarDays className="h-10 w-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 font-medium">No hay ciclos todavía</p>
          <p className="text-white/30 text-sm mt-1">Crea el primer ciclo grupal antes de asignar planes grupales</p>
          <Link
            href="/dashboard/sesiones/nuevo"
            className="inline-flex items-center gap-2 mt-5 bg-[#FF914D] hover:bg-[#e07a3a] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Plus className="h-4 w-4" />
            Crear primer ciclo
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {cycles.map((cycle: any) => {
            const status = getCycleStatus(cycle.start_date)
            const sessions: any[] = cycle.group_sessions ?? []

            const getSession = (label: string, difficulty: string) =>
              sessions.find((s: any) => s.label === label && s.difficulty === difficulty)

            const baseCount = (['A','B','C']).reduce((acc, label) => {
              const s = getSession(label, 'base')
              return acc + (s?.group_session_exercises?.length ?? 0)
            }, 0)

            return (
              <div key={cycle.id} className="bg-[#1C1C1C] rounded-2xl border border-white/10 overflow-hidden">
                {/* Header */}
                <Link href={`/dashboard/sesiones/${cycle.id}`} className="flex items-center justify-between px-5 py-4 border-b border-white/10 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                    <span className="text-white font-semibold">{formatDateRange(cycle.start_date)}</span>
                    {cycle.notes && <span className="text-white/30 text-xs">{cycle.notes}</span>}
                  </div>
                  <div className="flex items-center gap-1 text-white/30 text-xs">
                    <Dumbbell className="h-3.5 w-3.5" />
                    {baseCount} ejerc. base
                  </div>
                </Link>

                {/* Calendari del cicle */}
                <CycleCalendar startDate={cycle.start_date} />

                {/* Divisor */}
                <div className="mx-4 border-t border-white/[0.06]" />

                {/* Cuadrícula 3×3 */}
                <div className="p-4">
                  {/* Header columnas */}
                  <div className="grid gap-3 mb-2" style={{ gridTemplateColumns: '48px 1fr 1fr 1fr' }}>
                    <div />
                    {(['regression', 'base', 'progression'] as const).map(diff => (
                      <div key={diff} className="text-center">
                        <span className={`text-xs font-semibold ${DIFFICULTY_META[diff].color}`}>
                          {DIFFICULTY_META[diff].label}
                        </span>
                        <p className="text-[10px] text-white/30">{LEVEL_LABELS[diff]}</p>
                      </div>
                    ))}
                  </div>

                  {/* Filas A, B, C */}
                  {(['A', 'B', 'C'] as const).map(label => (
                    <div key={label} className="grid gap-3 mb-3" style={{ gridTemplateColumns: '48px 1fr 1fr 1fr' }}>
                      {/* Label sesión */}
                      <div className="flex items-center justify-center pt-2">
                        <span className="w-7 h-7 rounded-full bg-[#FF914D] text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {label}
                        </span>
                      </div>

                      {/* Regresión, Base, Progresión */}
                      {(['regression', 'base', 'progression'] as const).map(diff => {
                        const s = getSession(label, diff)
                        const count = s?.group_session_exercises?.length ?? 0
                        const isAuto = diff !== 'base'
                        const exercises: any[] = s?.group_session_exercises ?? []

                        return (
                          <div key={diff} className={`rounded-xl p-3 border ${isAuto ? 'border-white/5 bg-white/[0.02]' : 'border-white/10 bg-white/5'}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs text-white/50">{count} ejerc.</span>
                              {isAuto && (
                                <span className="flex items-center gap-0.5 text-[10px] text-white/20">
                                  <Zap className="h-2.5 w-2.5" />
                                  auto
                                </span>
                              )}
                            </div>
                            {exercises.map((ex: any, i: number) => (
                              <p key={i} className="text-[11px] text-white/50 leading-snug py-0.5" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {ex.exercises?.name ?? '—'}
                              </p>
                            ))}
                            {exercises.length === 0 && (
                              <p className="text-[11px] text-white/20 italic">Sense exercicis</p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
