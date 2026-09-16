import { getTodaySessionsAction } from '@/app/actions/session-logs'
import { CalendarClock, Clock, Dumbbell, Users, CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
  2: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
  3: 'bg-red-400/15 text-red-400 border-red-400/30',
}
const LEVEL_LABELS: Record<number, string> = {
  1: 'Groc', 2: 'Blau', 3: 'Vermell',
}

function formatTime(time: string | null) {
  if (!time) return null
  return time.slice(0, 5) // HH:MM
}

export default async function HoyPage() {
  const { sessions, error } = await getTodaySessionsAction()

  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const completed = sessions.filter((s: any) => s.session_logs?.[0]?.status === 'completed').length
  const inProgress = sessions.filter((s: any) => s.session_logs?.[0]?.status === 'in_progress').length
  const pending = sessions.length - completed - inProgress

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white capitalize">{today}</h1>
        <p className="text-white/40 text-sm mt-0.5">Agenda de sesiones de hoy</p>
      </div>

      {/* Stats rápidas */}
      {sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-[#1C1C1C] rounded-xl border border-white/10 p-3 text-center">
            <p className="text-2xl font-bold text-white">{sessions.length}</p>
            <p className="text-xs text-white/40 mt-0.5">Total</p>
          </div>
          <div className="bg-[#1C1C1C] rounded-xl border border-white/10 p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{completed}</p>
            <p className="text-xs text-white/40 mt-0.5">Completadas</p>
          </div>
          <div className="bg-[#1C1C1C] rounded-xl border border-white/10 p-3 text-center">
            <p className="text-2xl font-bold text-white/50">{pending}</p>
            <p className="text-xs text-white/40 mt-0.5">Pendientes</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-12 text-center">
          <CalendarClock className="h-10 w-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 font-medium">La agenda no está disponible aún</p>
          <p className="text-white/30 text-sm mt-1">Es necesario completar la configuración de la base de datos antes de usar esta sección.</p>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-12 text-center">
          <CalendarClock className="h-10 w-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 font-medium">No hay sesiones programadas hoy</p>
          <p className="text-white/30 text-sm mt-1">Las sesiones aparecen aquí cuando se asigna un slot horario en el plan</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s: any) => {
            const plan = s.training_plans
            const client = plan?.clients
            const log = s.session_logs?.[0]
            const isCompleted = log?.status === 'completed'
            const isInProgress = log?.status === 'in_progress'
            const exerciseCount = s.plan_session_exercises?.length ?? 0
            const time = formatTime(s.session_time)
            const level = plan?.level

            return (
              <Link
                key={s.id}
                href={`/dashboard/hoy/${s.id}`}
                className={`block bg-[#1C1C1C] rounded-2xl border transition-colors overflow-hidden
                  ${isCompleted
                    ? 'border-green-500/20 hover:border-green-500/40'
                    : isInProgress
                      ? 'border-[#FF914D]/40 hover:border-[#FF914D]/60'
                      : 'border-white/10 hover:border-white/20'
                  }`}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Hora */}
                  <div className="flex flex-col items-center justify-center w-14 shrink-0">
                    {time ? (
                      <>
                        <Clock className="h-3.5 w-3.5 text-white/30 mb-1" />
                        <span className="text-sm font-bold text-white">{time}</span>
                      </>
                    ) : (
                      <span className="text-xs text-white/20 text-center leading-tight">Sin hora</span>
                    )}
                  </div>

                  {/* Divisor vertical */}
                  <div className="w-px h-12 bg-white/10 shrink-0" />

                  {/* Info cliente */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-semibold truncate">
                        {client?.first_name} {client?.last_name}
                      </p>
                      {level && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_COLORS[level]}`}>
                          {LEVEL_LABELS[level]}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/40">
                      {plan?.type === 'group' ? (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Grupal · Sesión {s.session_label}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Dumbbell className="h-3 w-3" />
                          Individual
                        </span>
                      )}
                      <span>{exerciseCount} ejercicio{exerciseCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Estado */}
                  <div className="shrink-0">
                    {isCompleted ? (
                      <div className="flex items-center gap-1.5 text-green-400">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-xs font-medium hidden sm:block">Completada</span>
                      </div>
                    ) : isInProgress ? (
                      <div className="flex items-center gap-1.5 text-[#FF914D]">
                        <span className="w-2 h-2 rounded-full bg-[#FF914D] animate-pulse" />
                        <span className="text-xs font-medium hidden sm:block">En curso</span>
                      </div>
                    ) : (
                      <Circle className="h-5 w-5 text-white/20" />
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
