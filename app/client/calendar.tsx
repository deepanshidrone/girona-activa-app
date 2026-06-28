'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, X, Dumbbell } from 'lucide-react'

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

type SessionExercise = {
  id: string
  sets: number
  reps: number
  weight_kg: number | null
  notes: string | null
  order_index: number
  exercises: { id: string; name: string } | null
}

type Session = {
  id: string
  session_date: string
  notes: string | null
  plan_session_exercises: SessionExercise[]
}

interface Props {
  sessions: Session[]
  startDate: string
  durationMonths: number
}

function getMonthsInRange(startDate: string, months: number) {
  const result = []
  const start = new Date(startDate)
  for (let i = 0; i < months; i++) {
    const d = new Date(start)
    d.setMonth(d.getMonth() + i)
    result.push({ year: d.getFullYear(), month: d.getMonth() })
  }
  return result
}

export function ClientCalendar({ sessions, startDate, durationMonths }: Props) {
  const months = getMonthsInRange(startDate, durationMonths)
  const [currentMonthIdx, setCurrentMonthIdx] = useState(0)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)

  const sessionMap = new Map(sessions.map(s => [s.session_date, s]))
  const { year, month } = months[currentMonthIdx]

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7

  const cells: (number | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date().toISOString().split('T')[0]

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
        {/* Navegación meses */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonthIdx(i => Math.max(0, i - 1))}
            disabled={currentMonthIdx === 0}
            className="p-1.5 rounded-lg hover:bg-[#F5F5F5] disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-[#1C1C1C]" />
          </button>
          <h2 className="font-bold text-[#1C1C1C]">{MONTHS_ES[month]} {year}</h2>
          <button
            onClick={() => setCurrentMonthIdx(i => Math.min(months.length - 1, i + 1))}
            disabled={currentMonthIdx === months.length - 1}
            className="p-1.5 rounded-lg hover:bg-[#F5F5F5] disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-[#1C1C1C]" />
          </button>
        </div>

        {/* Días semana */}
        <div className="grid grid-cols-7 mb-2">
          {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-[#666666] py-1">{d}</div>
          ))}
        </div>

        {/* Grid días */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const session = sessionMap.get(dateStr)
            const hasExercises = (session?.plan_session_exercises?.length ?? 0) > 0
            const isToday = dateStr === today

            return (
              <button
                key={i}
                onClick={() => session && setSelectedSession(session)}
                disabled={!session}
                className={`aspect-square rounded-xl text-sm font-medium transition-all flex flex-col items-center justify-center gap-0.5
                  ${session
                    ? hasExercises
                      ? 'bg-[#FF914D] text-white shadow-sm active:scale-95'
                      : 'bg-orange-100 text-[#FF914D] border border-[#FF914D]'
                    : isToday
                      ? 'bg-[#1C1C1C] text-white'
                      : 'text-[#1C1C1C]'
                  }`}
              >
                {day}
                {session && hasExercises && (
                  <span className="text-[8px] opacity-80">{session.plan_session_exercises.length}ej</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#E5E5E5]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-[#FF914D]" />
            <span className="text-xs text-[#666666]">Entreno</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-orange-100 border border-[#FF914D]" />
            <span className="text-xs text-[#666666]">Sin asignar</span>
          </div>
        </div>
      </div>

      {/* Indicador de meses */}
      {months.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {months.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentMonthIdx(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === currentMonthIdx ? 'bg-[#FF914D]' : 'bg-[#E5E5E5]'}`}
            />
          ))}
        </div>
      )}

      {/* Panel detalle día */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="flex-1 bg-black/40" onClick={() => setSelectedSession(null)} />
          <div className="bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#E5E5E5]" />
            </div>

            <div className="px-5 pb-8">
              {/* Header */}
              <div className="flex items-center justify-between py-3 mb-4">
                <div>
                  <h3 className="font-bold text-[#1C1C1C] text-lg">
                    {new Date(selectedSession.session_date + 'T12:00:00').toLocaleDateString('es-ES', {
                      weekday: 'long', day: 'numeric', month: 'long'
                    })}
                  </h3>
                  <p className="text-sm text-[#666666]">
                    {selectedSession.plan_session_exercises.length} ejercicio{selectedSession.plan_session_exercises.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={() => setSelectedSession(null)} className="p-2 rounded-full hover:bg-[#F5F5F5]">
                  <X className="h-5 w-5 text-[#666666]" />
                </button>
              </div>

              {/* Ejercicios */}
              {selectedSession.plan_session_exercises.length === 0 ? (
                <p className="text-[#666666] text-sm text-center py-6">Tu entrenador todavía no ha asignado ejercicios para este día.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {[...selectedSession.plan_session_exercises]
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((ex, i) => (
                      <div key={ex.id} className="bg-[#F5F5F5] rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-[#FF914D]/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Dumbbell className="h-4 w-4 text-[#FF914D]" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-[#1C1C1C]">{ex.exercises?.name ?? 'Ejercicio'}</p>
                            <div className="flex gap-3 mt-1.5">
                              <span className="text-sm text-[#666666]">
                                <span className="font-medium text-[#1C1C1C]">{ex.sets}</span> series
                              </span>
                              <span className="text-sm text-[#666666]">
                                <span className="font-medium text-[#1C1C1C]">{ex.reps}</span> reps
                              </span>
                              {ex.weight_kg && (
                                <span className="text-sm text-[#666666]">
                                  <span className="font-medium text-[#1C1C1C]">{ex.weight_kg}</span> kg
                                </span>
                              )}
                            </div>
                            {ex.notes && (
                              <p className="text-sm text-[#666666] mt-2 bg-white rounded-lg px-3 py-2 italic">
                                "{ex.notes}"
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Notas del entrenador */}
              {selectedSession.notes && (
                <div className="mt-4 bg-orange-50 border border-[#FF914D]/20 rounded-2xl p-4">
                  <p className="text-xs font-medium text-[#FF914D] mb-1">Nota del entrenador</p>
                  <p className="text-sm text-[#1C1C1C]">{selectedSession.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
