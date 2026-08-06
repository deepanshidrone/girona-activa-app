'use client'

import { useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight, X, Dumbbell, Trash2, Plus, Move } from 'lucide-react'
import {
  moveSessionAction,
  updateSessionExerciseAction,
  deleteSessionExerciseAction,
  addSessionExerciseAction,
} from '@/app/actions/edit-plan'

const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

type Exercise = { id: string; name: string }
type SessionExercise = {
  id: string; sets: number; reps: number; weight_kg: number | null
  notes: string | null; order_index: number; exercises: Exercise | null
}
type Session = {
  id: string; session_date: string; notes: string | null
  plan_session_exercises: SessionExercise[]
}

interface Props {
  planId: string
  sessions: Session[]
  startDate: string
  durationMonths: number
  allExercises: Exercise[]
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

export function EditPlanCalendar({ sessions: initialSessions, startDate, durationMonths, allExercises }: Props) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions)
  const [currentMonthIdx, setCurrentMonthIdx] = useState(0)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Move session panel
  const [movingDate, setMovingDate] = useState('')
  const [showMovePanel, setShowMovePanel] = useState(false)

  // Add exercise panel
  const [showAddExercise, setShowAddExercise] = useState(false)
  const [newEx, setNewEx] = useState({ exerciseId: '', sets: 3, reps: 10, weight_kg: '', notes: '' })

  // Edit exercise inline
  const [editingExId, setEditingExId] = useState<string | null>(null)
  const [editExData, setEditExData] = useState({ sets: 0, reps: 0, weight_kg: '', notes: '' })

  const months = getMonthsInRange(startDate, durationMonths)
  const sessionMap = new Map(sessions.map(s => [s.session_date, s]))
  const { year, month } = months[currentMonthIdx]

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7
  const cells: (number | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const today = new Date().toISOString().split('T')[0]

  function updateSessionInState(updated: Session) {
    setSessions(prev => prev.map(s => s.id === updated.id ? updated : s))
    setSelectedSession(updated)
  }

  // Move session
  function handleMoveSession() {
    if (!selectedSession || !movingDate) return
    if (sessionMap.has(movingDate)) { setError('Ya hay una sesión en esa fecha'); return }
    setError('')
    startTransition(async () => {
      const result = await moveSessionAction(selectedSession.id, movingDate)
      if (result.error) { setError(result.error); return }
      setSessions(prev => prev.map(s =>
        s.id === selectedSession.id ? { ...s, session_date: movingDate } : s
      ))
      setSelectedSession(prev => prev ? { ...prev, session_date: movingDate } : null)
      setShowMovePanel(false)
      setMovingDate('')
    })
  }

  // Delete exercise
  function handleDeleteExercise(exId: string) {
    if (!selectedSession) return
    startTransition(async () => {
      const result = await deleteSessionExerciseAction(exId)
      if (result.error) { setError(result.error); return }
      const updated = {
        ...selectedSession,
        plan_session_exercises: selectedSession.plan_session_exercises.filter(e => e.id !== exId),
      }
      updateSessionInState(updated)
    })
  }

  // Update exercise
  function handleUpdateExercise(exId: string) {
    if (!selectedSession) return
    const sets = Number(editExData.sets)
    const reps = Number(editExData.reps)
    const weight = editExData.weight_kg ? Number(editExData.weight_kg) : null
    startTransition(async () => {
      const result = await updateSessionExerciseAction(exId, sets, reps, weight, editExData.notes || null)
      if (result.error) { setError(result.error); return }
      const updated = {
        ...selectedSession,
        plan_session_exercises: selectedSession.plan_session_exercises.map(e =>
          e.id === exId ? { ...e, sets, reps, weight_kg: weight, notes: editExData.notes || null } : e
        ),
      }
      updateSessionInState(updated)
      setEditingExId(null)
    })
  }

  // Add exercise
  function handleAddExercise() {
    if (!selectedSession || !newEx.exerciseId) return
    const orderIndex = selectedSession.plan_session_exercises.length
    const sets = Number(newEx.sets)
    const reps = Number(newEx.reps)
    const weight = newEx.weight_kg ? Number(newEx.weight_kg) : null
    startTransition(async () => {
      const result = await addSessionExerciseAction(
        selectedSession.id, newEx.exerciseId, sets, reps, weight, newEx.notes || null, orderIndex
      )
      if (result.error) { setError(result.error); return }
      const exercise = allExercises.find(e => e.id === newEx.exerciseId) ?? null
      const updated = {
        ...selectedSession,
        plan_session_exercises: [
          ...selectedSession.plan_session_exercises,
          { id: Date.now().toString(), sets, reps, weight_kg: weight, notes: newEx.notes || null, order_index: orderIndex, exercises: exercise },
        ],
      }
      updateSessionInState(updated)
      setNewEx({ exerciseId: '', sets: 3, reps: 10, weight_kg: '', notes: '' })
      setShowAddExercise(false)
    })
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
        {/* Nav meses */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonthIdx(i => Math.max(0, i - 1))} disabled={currentMonthIdx === 0}
            className="p-1.5 rounded-lg hover:bg-[#F5F5F5] disabled:opacity-30 transition-colors">
            <ChevronLeft className="h-5 w-5 text-[#1C1C1C]" />
          </button>
          <h2 className="font-bold text-[#1C1C1C]">{MONTHS_ES[month]} {year}</h2>
          <button onClick={() => setCurrentMonthIdx(i => Math.min(months.length - 1, i + 1))} disabled={currentMonthIdx === months.length - 1}
            className="p-1.5 rounded-lg hover:bg-[#F5F5F5] disabled:opacity-30 transition-colors">
            <ChevronRight className="h-5 w-5 text-[#1C1C1C]" />
          </button>
        </div>

        {/* Días semana */}
        <div className="grid grid-cols-7 mb-2">
          {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-[#666666] py-1">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const session = sessionMap.get(dateStr)
            const hasExercises = (session?.plan_session_exercises?.length ?? 0) > 0
            const isToday = dateStr === today

            return (
              <button key={i}
                onClick={() => session && setSelectedSession(session)}
                disabled={!session}
                className={`aspect-square rounded-xl text-sm font-medium transition-all flex flex-col items-center justify-center gap-0.5
                  ${session
                    ? hasExercises
                      ? 'bg-[#FF914D] text-white shadow-sm active:scale-95 cursor-pointer'
                      : 'bg-orange-100 text-[#FF914D] border border-[#FF914D] cursor-pointer'
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
            <span className="text-xs text-[#666666]">Con ejercicios</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-orange-100 border border-[#FF914D]" />
            <span className="text-xs text-[#666666]">Sin ejercicios</span>
          </div>
        </div>
      </div>

      {/* Dots navegación meses */}
      {months.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {months.map((_, i) => (
            <button key={i} onClick={() => setCurrentMonthIdx(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === currentMonthIdx ? 'bg-[#FF914D]' : 'bg-[#E5E5E5]'}`} />
          ))}
        </div>
      )}

      {/* Panel sesión */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="flex-1 bg-black/40" onClick={() => { setSelectedSession(null); setShowMovePanel(false); setShowAddExercise(false); setEditingExId(null) }} />
          <div className="bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#E5E5E5]" />
            </div>

            <div className="px-5 pb-8">
              {/* Header */}
              <div className="flex items-center justify-between py-3 mb-2">
                <div>
                  <h3 className="font-bold text-[#1C1C1C] text-lg">
                    {new Date(selectedSession.session_date + 'T12:00:00').toLocaleDateString('es-ES', {
                      weekday: 'long', day: 'numeric', month: 'long'
                    })}
                  </h3>
                  <p className="text-sm text-[#666666]">{selectedSession.plan_session_exercises.length} ejercicio{selectedSession.plan_session_exercises.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => { setSelectedSession(null); setShowMovePanel(false); setShowAddExercise(false); setEditingExId(null) }}
                  className="p-2 rounded-full hover:bg-[#F5F5F5]">
                  <X className="h-5 w-5 text-[#666666]" />
                </button>
              </div>

              {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>}

              {/* Mover sesión */}
              <div className="mb-4">
                {!showMovePanel ? (
                  <button onClick={() => setShowMovePanel(true)}
                    className="flex items-center gap-2 text-sm text-[#666666] hover:text-[#1C1C1C] transition-colors">
                    <Move className="h-4 w-4" />
                    Mover sesión a otro día
                  </button>
                ) : (
                  <div className="bg-[#F5F5F5] rounded-xl p-3 flex items-center gap-3">
                    <input type="date" value={movingDate} onChange={e => setMovingDate(e.target.value)}
                      className="border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FF914D] bg-white" />
                    <button onClick={handleMoveSession} disabled={!movingDate || isPending}
                      className="bg-[#FF914D] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#e07a3a] disabled:opacity-60 transition-colors">
                      Mover
                    </button>
                    <button onClick={() => { setShowMovePanel(false); setMovingDate('') }}
                      className="text-sm text-[#666666] hover:text-[#1C1C1C]">Cancelar</button>
                  </div>
                )}
              </div>

              {/* Ejercicios */}
              <div className="flex flex-col gap-3 mb-4">
                {selectedSession.plan_session_exercises.map((ex) => (
                  <div key={ex.id} className="bg-[#F5F5F5] rounded-2xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg bg-[#FF914D]/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Dumbbell className="h-4 w-4 text-[#FF914D]" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-[#1C1C1C] text-sm">{ex.exercises?.name ?? 'Ejercicio'}</p>

                          {editingExId === ex.id ? (
                            <div className="mt-2 flex flex-col gap-2">
                              <div className="flex gap-2">
                                <input type="number" value={editExData.sets} onChange={e => setEditExData(p => ({ ...p, sets: Number(e.target.value) }))}
                                  placeholder="Series" className="w-20 border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#FF914D] bg-white" />
                                <input type="number" value={editExData.reps} onChange={e => setEditExData(p => ({ ...p, reps: Number(e.target.value) }))}
                                  placeholder="Reps" className="w-20 border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#FF914D] bg-white" />
                                <input type="number" value={editExData.weight_kg} onChange={e => setEditExData(p => ({ ...p, weight_kg: e.target.value }))}
                                  placeholder="Kg" className="w-20 border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#FF914D] bg-white" />
                              </div>
                              <input type="text" value={editExData.notes} onChange={e => setEditExData(p => ({ ...p, notes: e.target.value }))}
                                placeholder="Nota (opcional)" className="border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#FF914D] bg-white" />
                              <div className="flex gap-2">
                                <button onClick={() => handleUpdateExercise(ex.id)} disabled={isPending}
                                  className="bg-[#FF914D] text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-[#e07a3a] disabled:opacity-60">
                                  Guardar
                                </button>
                                <button onClick={() => setEditingExId(null)} className="text-xs text-[#666666]">Cancelar</button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex gap-3 mt-1">
                              <span className="text-sm text-[#666666]"><span className="font-medium text-[#1C1C1C]">{ex.sets}</span> series</span>
                              <span className="text-sm text-[#666666]"><span className="font-medium text-[#1C1C1C]">{ex.reps}</span> reps</span>
                              {ex.weight_kg && <span className="text-sm text-[#666666]"><span className="font-medium text-[#1C1C1C]">{ex.weight_kg}</span> kg</span>}
                            </div>
                          )}
                          {ex.notes && editingExId !== ex.id && (
                            <p className="text-xs text-[#666666] mt-1 italic">"{ex.notes}"</p>
                          )}
                        </div>
                      </div>

                      {editingExId !== ex.id && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => {
                            setEditingExId(ex.id)
                            setEditExData({ sets: ex.sets, reps: ex.reps, weight_kg: ex.weight_kg?.toString() ?? '', notes: ex.notes ?? '' })
                          }} className="text-xs text-[#666666] hover:text-[#1C1C1C] px-2 py-1 rounded-lg hover:bg-white transition-colors">
                            Editar
                          </button>
                          <button onClick={() => handleDeleteExercise(ex.id)} disabled={isPending}
                            className="p-1.5 rounded-lg hover:bg-white text-red-400 hover:text-red-500 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Añadir ejercicio */}
              {!showAddExercise ? (
                <button onClick={() => setShowAddExercise(true)}
                  className="flex items-center gap-2 text-sm font-medium text-[#FF914D] hover:text-[#e07a3a] transition-colors">
                  <Plus className="h-4 w-4" />
                  Añadir ejercicio
                </button>
              ) : (
                <div className="bg-[#F5F5F5] rounded-2xl p-4 flex flex-col gap-3">
                  <p className="text-sm font-medium text-[#1C1C1C]">Añadir ejercicio</p>
                  <select value={newEx.exerciseId} onChange={e => setNewEx(p => ({ ...p, exerciseId: e.target.value }))}
                    className="border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FF914D] bg-white">
                    <option value="">Selecciona ejercicio...</option>
                    {allExercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <input type="number" value={newEx.sets} onChange={e => setNewEx(p => ({ ...p, sets: Number(e.target.value) }))}
                      placeholder="Series" className="w-20 border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#FF914D] bg-white" />
                    <input type="number" value={newEx.reps} onChange={e => setNewEx(p => ({ ...p, reps: Number(e.target.value) }))}
                      placeholder="Reps" className="w-20 border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#FF914D] bg-white" />
                    <input type="number" value={newEx.weight_kg} onChange={e => setNewEx(p => ({ ...p, weight_kg: e.target.value }))}
                      placeholder="Kg (opt.)" className="w-24 border border-[#E5E5E5] rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#FF914D] bg-white" />
                  </div>
                  <input type="text" value={newEx.notes} onChange={e => setNewEx(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Nota (opcional)" className="border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#FF914D] bg-white" />
                  <div className="flex gap-2">
                    <button onClick={handleAddExercise} disabled={!newEx.exerciseId || isPending}
                      className="bg-[#FF914D] text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-[#e07a3a] disabled:opacity-60 transition-colors">
                      Añadir
                    </button>
                    <button onClick={() => setShowAddExercise(false)} className="text-sm text-[#666666]">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
