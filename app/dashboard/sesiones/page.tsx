import { getGroupCyclesAction } from '@/app/actions/group-sessions'
import { Plus, CalendarDays, Dumbbell } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

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

export default async function SesionesPage() {
  const { cycles } = await getGroupCyclesAction()

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sesiones grupales</h1>
          <p className="text-white/50 text-sm mt-0.5">Ciclos de 2 semanas con sesiones A, B y C</p>
        </div>
        <Link
          href="/dashboard/sesiones/nuevo"
          className="flex items-center gap-2 bg-[#FF914D] hover:bg-[#e07a3a] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nuevo ciclo
        </Link>
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
        <div className="flex flex-col gap-4">
          {cycles.map((cycle: any) => {
            const status = getCycleStatus(cycle.start_date)
            const sessions = (cycle.group_sessions ?? []).sort((a: any, b: any) => a.label.localeCompare(b.label))
            const totalExercises = sessions.reduce((acc: number, s: any) => acc + (s.group_session_exercises?.length ?? 0), 0)

            return (
              <div key={cycle.id} className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${status.color}`}>
                        {status.label}
                      </span>
                      <span className="text-white font-semibold text-sm">{formatDateRange(cycle.start_date)}</span>
                    </div>
                    {cycle.notes && <p className="text-white/40 text-xs">{cycle.notes}</p>}
                  </div>
                  <div className="flex items-center gap-1 text-white/30 text-xs shrink-0">
                    <Dumbbell className="h-3.5 w-3.5" />
                    {totalExercises} ejercicios
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {(['A', 'B', 'C'] as const).map(label => {
                    const s = sessions.find((s: any) => s.label === label)
                    const count = s?.group_session_exercises?.length ?? 0
                    return (
                      <div key={label} className="bg-white/5 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="w-6 h-6 rounded-full bg-[#FF914D] text-white text-xs font-bold flex items-center justify-center">
                            {label}
                          </span>
                          <span className="text-white/30 text-xs">{count} ejerc.</span>
                        </div>
                        <p className="text-white/50 text-xs line-clamp-2 min-h-[2rem]">
                          {s?.notes || (count > 0 ? `${count} ejercicios definidos` : 'Sin notas')}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
