'use client'

import { useState, useTransition, useOptimistic, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2, Plus, Search, X } from 'lucide-react'
import {
  updateGroupSessionExerciseAction,
  addGroupSessionExerciseAction,
  deleteGroupSessionExerciseAction,
  swapGroupSessionExerciseAction,
} from '@/app/actions/group-sessions'

type Exercise = { id: string; name: string; technical_name?: string | null }

type GSE = {
  id: string
  exercise_id: string
  sets: number
  reps: number
  weight_kg?: number | null
  notes?: string | null
  order_index: number
  exercises: Exercise
}

type GroupSession = {
  id: string
  label: string
  difficulty: string
  notes?: string | null
  group_session_exercises: GSE[]
}

type Cycle = {
  id: string
  start_date: string
  notes?: string | null
  group_sessions: GroupSession[]
}

type Props = {
  cycle: Cycle
  exercises: Exercise[]
}

const DIFF_META = {
  regression:  { label: 'Regressió',  color: 'text-blue-400',   border: 'border-blue-400/20',   bg: 'bg-blue-400/5'   },
  base:        { label: 'Base',       color: 'text-[#FF914D]',  border: 'border-[#FF914D]/20',  bg: 'bg-[#FF914D]/5'  },
  progression: { label: 'Progressió', color: 'text-purple-400', border: 'border-purple-400/20', bg: 'bg-purple-400/5' },
} as const

function formatDateRange(startDate: string) {
  const start = new Date(startDate)
  const end = new Date(startDate)
  end.setDate(end.getDate() + 13)
  const fmt = (d: Date) => d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })
  return `${fmt(start)} — ${fmt(end)}`
}

function getCycleStatus(startDate: string): { label: string; color: string } {
  const start = new Date(startDate)
  const end = new Date(startDate)
  end.setDate(end.getDate() + 14)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (today < start) return { label: 'Pròxim', color: 'text-blue-400 bg-blue-400/10' }
  if (today >= start && today < end) return { label: 'Actiu', color: 'text-green-400 bg-green-400/10' }
  return { label: 'Expirat', color: 'text-white/30 bg-white/5' }
}

function ExercisePicker({
  exercises,
  onSelect,
  onClose,
}: {
  exercises: Exercise[]
  onSelect: (ex: Exercise) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(query.toLowerCase()) ||
    (e.technical_name ?? '').toLowerCase().includes(query.toLowerCase())
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 w-full max-w-md p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white font-semibold">Selecciona exercici</span>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cerca exercici..."
            className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF914D]/50"
          />
        </div>
        <div className="max-h-72 overflow-y-auto flex flex-col gap-1">
          {filtered.length === 0 && (
            <p className="text-white/30 text-sm text-center py-4">Sense resultats</p>
          )}
          {filtered.map(ex => (
            <button
              key={ex.id}
              onClick={() => { onSelect(ex); onClose() }}
              className="flex flex-col items-start px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left"
            >
              <span className="text-white text-sm">{ex.name}</span>
              {ex.technical_name && <span className="text-white/30 text-xs">{ex.technical_name}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ExerciseRow({
  gse,
  onUpdate,
  onDelete,
  onSwap,
}: {
  gse: GSE
  onUpdate: (id: string, data: Partial<Pick<GSE, 'sets' | 'reps' | 'weight_kg' | 'notes'>>) => void
  onDelete: (id: string) => void
  onSwap: (id: string) => void
}) {
  const [sets, setSets] = useState(String(gse.sets))
  const [reps, setReps] = useState(String(gse.reps))
  const [weight, setWeight] = useState(gse.weight_kg != null ? String(gse.weight_kg) : '')

  const inputCls = "w-12 bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-[#FF914D]/50"

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{gse.exercises?.name ?? '—'}</p>
        {gse.exercises?.technical_name && (
          <p className="text-white/30 text-[10px] truncate">{gse.exercises.technical_name}</p>
        )}
      </div>
      <input
        className={inputCls}
        value={sets}
        onChange={e => setSets(e.target.value)}
        onBlur={() => { const v = parseInt(sets); if (!isNaN(v) && v > 0) onUpdate(gse.id, { sets: v }) }}
        title="Sèries"
      />
      <span className="text-white/20 text-xs">×</span>
      <input
        className={inputCls}
        value={reps}
        onChange={e => setReps(e.target.value)}
        onBlur={() => { const v = parseInt(reps); if (!isNaN(v) && v > 0) onUpdate(gse.id, { reps: v }) }}
        title="Reps"
      />
      <input
        className="w-14 bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-[#FF914D]/50"
        value={weight}
        onChange={e => setWeight(e.target.value)}
        onBlur={() => {
          const v = weight === '' ? null : parseFloat(weight)
          onUpdate(gse.id, { weight_kg: v })
        }}
        placeholder="kg"
        title="Càrrega"
      />
      <button onClick={() => onSwap(gse.id)} className="text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/5">
        <Pencil className="h-3 w-3" />
      </button>
      <button onClick={() => onDelete(gse.id)} className="text-white/30 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-400/10">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

type SessionState = { [sessionId: string]: GSE[] }

export default function CycleEditor({ cycle, exercises }: Props) {
  const [, startTransition] = useTransition()

  const buildInitialState = (): SessionState => {
    const state: SessionState = {}
    for (const s of cycle.group_sessions) {
      state[s.id] = [...s.group_session_exercises].sort((a, b) => a.order_index - b.order_index)
    }
    return state
  }

  const [sessionExercises, setSessionExercises] = useOptimistic(buildInitialState())

  const [pickerOpen, setPickerOpen] = useState<null | { sessionId: string; swapGseId?: string }>(null)

  const status = getCycleStatus(cycle.start_date)

  const getSession = useCallback(
    (label: string, difficulty: string) =>
      cycle.group_sessions.find(s => s.label === label && s.difficulty === difficulty),
    [cycle.group_sessions]
  )

  const handleUpdate = (gseId: string, data: Partial<Pick<GSE, 'sets' | 'reps' | 'weight_kg' | 'notes'>>) => {
    startTransition(async () => {
      await updateGroupSessionExerciseAction(gseId, data)
    })
  }

  const handleDelete = (sessionId: string, gseId: string) => {
    startTransition(async () => {
      setSessionExercises(prev => ({
        ...prev,
        [sessionId]: (prev[sessionId] ?? []).filter(e => e.id !== gseId),
      }))
      await deleteGroupSessionExerciseAction(gseId)
    })
  }

  const handleAdd = (sessionId: string, ex: Exercise) => {
    startTransition(async () => {
      const current = sessionExercises[sessionId] ?? []
      const order_index = current.length
      const tempId = `temp-${Date.now()}`
      const tempGSE: GSE = {
        id: tempId,
        exercise_id: ex.id,
        sets: 3,
        reps: 10,
        weight_kg: null,
        notes: null,
        order_index,
        exercises: ex,
      }
      setSessionExercises(prev => ({
        ...prev,
        [sessionId]: [...(prev[sessionId] ?? []), tempGSE],
      }))
      const result = await addGroupSessionExerciseAction(sessionId, ex.id, { sets: 3, reps: 10, order_index })
      if (result.row) {
        setSessionExercises(prev => ({
          ...prev,
          [sessionId]: (prev[sessionId] ?? []).map(e => e.id === tempId ? (result.row as GSE) : e),
        }))
      }
    })
  }

  const handleSwapPick = (gseId: string, ex: Exercise, sessionId: string) => {
    startTransition(async () => {
      setSessionExercises(prev => ({
        ...prev,
        [sessionId]: (prev[sessionId] ?? []).map(e =>
          e.id === gseId ? { ...e, exercise_id: ex.id, exercises: ex } : e
        ),
      }))
      await swapGroupSessionExerciseAction(gseId, ex.id)
    })
  }

  return (
    <div className="min-h-screen bg-[#111111] p-6">
      {pickerOpen && (
        <ExercisePicker
          exercises={exercises}
          onSelect={ex => {
            if (pickerOpen.swapGseId) {
              handleSwapPick(pickerOpen.swapGseId, ex, pickerOpen.sessionId)
            } else {
              handleAdd(pickerOpen.sessionId, ex)
            }
          }}
          onClose={() => setPickerOpen(null)}
        />
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/sesiones"
              className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Tornar
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-white font-semibold">{formatDateRange(cycle.start_date)}</span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${status.color}`}>
              {status.label}
            </span>
          </div>
          {cycle.notes && <p className="text-white/40 text-sm">{cycle.notes}</p>}
        </div>

        <div className="grid grid-cols-4 gap-3 mb-3">
          <div />
          {(['regression', 'base', 'progression'] as const).map(diff => (
            <div key={diff} className="text-center">
              <span className={`text-sm font-semibold ${DIFF_META[diff].color}`}>
                {DIFF_META[diff].label}
              </span>
            </div>
          ))}
        </div>

        {(['A', 'B', 'C'] as const).map(label => (
          <div key={label} className="grid grid-cols-4 gap-3 mb-3">
            <div className="flex items-start pt-3 justify-center">
              <span className="w-8 h-8 rounded-full bg-[#FF914D] text-white text-sm font-bold flex items-center justify-center">
                {label}
              </span>
            </div>
            {(['regression', 'base', 'progression'] as const).map(diff => {
              const session = getSession(label, diff)
              const meta = DIFF_META[diff]
              const gses = session ? (sessionExercises[session.id] ?? []) : []

              return (
                <div key={diff} className={`rounded-xl border ${meta.border} ${meta.bg} p-3`}>
                  {!session ? (
                    <p className="text-white/20 text-xs italic">Sense sessió</p>
                  ) : (
                    <>
                      {gses.map(gse => (
                        <ExerciseRow
                          key={gse.id}
                          gse={gse}
                          onUpdate={handleUpdate}
                          onDelete={id => handleDelete(session.id, id)}
                          onSwap={id => setPickerOpen({ sessionId: session.id, swapGseId: id })}
                        />
                      ))}
                      {gses.length === 0 && (
                        <p className="text-white/20 text-xs italic mb-2">Sense exercicis</p>
                      )}
                      <button
                        onClick={() => setPickerOpen({ sessionId: session.id })}
                        className={`mt-2 w-full flex items-center justify-center gap-1 text-xs ${meta.color} hover:opacity-80 transition-opacity py-1.5 rounded-lg border border-dashed ${meta.border}`}
                      >
                        <Plus className="h-3 w-3" />
                        Afegir exercici
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
