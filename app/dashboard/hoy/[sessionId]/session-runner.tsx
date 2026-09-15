'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  startSessionLogAction,
  saveExerciseLogAction,
  completeSessionLogAction,
} from '@/app/actions/session-logs'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Dumbbell, SkipForward } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const LEVEL_LABELS: Record<number, string> = { 1: 'Groc', 2: 'Blau', 3: 'Vermell' }
const LEVEL_COLORS: Record<number, string> = {
  1: 'bg-yellow-400/15 text-yellow-400 border-yellow-400/30',
  2: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
  3: 'bg-red-400/15 text-red-400 border-red-400/30',
}

type ExerciseItem = {
  id: string
  sets: number
  reps: number
  weight_kg: number | null
  notes: string | null
  exercises: { id: string; name: string; technical_name: string | null }
}

type ExistingLog = {
  id: string
  status: string
  notes: string | null
  exercise_logs: {
    id: string
    plan_exercise_id: string
    sets_done: number | null
    reps_done: number | null
    load_kg: number | null
    effort: number | null
    notes: string | null
    skipped: boolean
  }[]
}

type ExerciseFormState = {
  sets_done: string
  reps_done: string
  load_kg: string
  effort: string
  notes: string
  skipped: boolean
  saved: boolean
}

interface Props {
  planSessionId: string
  sessionDate: string
  sessionTime: string | null
  client: { id: string; first_name: string; last_name: string }
  planLevel: number
  planType: string
  exercises: ExerciseItem[]
  existingLog: ExistingLog | null
}

function initExerciseState(exercise: ExerciseItem, log: ExistingLog | null): ExerciseFormState {
  const existing = log?.exercise_logs?.find(el => el.plan_exercise_id === exercise.id)
  if (existing) {
    return {
      sets_done: existing.sets_done?.toString() ?? '',
      reps_done: existing.reps_done?.toString() ?? '',
      load_kg: existing.load_kg?.toString() ?? '',
      effort: existing.effort?.toString() ?? '',
      notes: existing.notes ?? '',
      skipped: existing.skipped ?? false,
      saved: true,
    }
  }
  return {
    sets_done: exercise.sets?.toString() ?? '',
    reps_done: exercise.reps?.toString() ?? '',
    load_kg: exercise.weight_kg?.toString() ?? '',
    effort: '',
    notes: '',
    skipped: false,
    saved: false,
  }
}

export function SessionRunner({ planSessionId, sessionDate, sessionTime, client, planLevel, planType, exercises, existingLog }: Props) {
  const router = useRouter()
  const [sessionLogId, setSessionLogId] = useState<string | null>(existingLog?.id ?? null)
  const [sessionStatus, setSessionStatus] = useState<string>(existingLog?.status ?? 'pending')
  const [starting, setStarting] = useState(false)
  const [completing, setCompleting] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [forms, setForms] = useState<Record<string, ExerciseFormState>>(() =>
    Object.fromEntries(exercises.map(ex => [ex.id, initExerciseState(ex, existingLog)]))
  )
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const dateLabel = new Date(sessionDate + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
  const timeLabel = sessionTime ? sessionTime.slice(0, 5) : null

  async function handleStart() {
    setStarting(true)
    const result = await startSessionLogAction(planSessionId, client.id)
    setStarting(false)
    if ('error' in result) { alert(result.error); return }
    setSessionLogId(result.session_log_id!)
    setSessionStatus(result.status!)
  }

  function updateField(exerciseId: string, field: keyof ExerciseFormState, value: string | boolean) {
    setForms(prev => ({ ...prev, [exerciseId]: { ...prev[exerciseId], [field]: value, saved: false } }))
  }

  async function handleSaveExercise(exercise: ExerciseItem) {
    if (!sessionLogId) return
    setSaving(prev => ({ ...prev, [exercise.id]: true }))
    const form = forms[exercise.id]
    await saveExerciseLogAction(sessionLogId, {
      exercise_id: exercise.exercises.id,
      plan_exercise_id: exercise.id,
      sets_done: form.sets_done ? parseInt(form.sets_done) : undefined,
      reps_done: form.reps_done ? parseInt(form.reps_done) : undefined,
      load_kg: form.load_kg ? parseFloat(form.load_kg) : undefined,
      effort: form.effort ? parseInt(form.effort) : undefined,
      notes: form.notes || undefined,
      skipped: form.skipped,
    })
    setSaving(prev => ({ ...prev, [exercise.id]: false }))
    setForms(prev => ({ ...prev, [exercise.id]: { ...prev[exercise.id], saved: true } }))
    setExpandedId(null)
  }

  async function handleComplete() {
    if (!sessionLogId) return
    setCompleting(true)
    await completeSessionLogAction(sessionLogId)
    setCompleting(false)
    setSessionStatus('completed')
    router.push('/dashboard/hoy')
  }

  const savedCount = Object.values(forms).filter(f => f.saved).length
  const allSaved = savedCount === exercises.length

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/hoy" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white truncate">
              {client.first_name} {client.last_name}
            </h1>
            {planLevel && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${LEVEL_COLORS[planLevel]}`}>
                {LEVEL_LABELS[planLevel]}
              </span>
            )}
          </div>
          <p className="text-white/40 text-sm capitalize mt-0.5">
            {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''} · {exercises.length} ejercicios
          </p>
        </div>
      </div>

      {/* Estado — botón iniciar o completar */}
      {sessionStatus === 'pending' && (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5 mb-5 text-center">
          <Dumbbell className="h-8 w-8 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm mb-4">Inicia la sesión para empezar a registrar</p>
          <Button
            onClick={handleStart}
            disabled={starting}
            className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold px-8"
          >
            {starting ? 'Iniciando...' : 'Iniciar sesión'}
          </Button>
        </div>
      )}

      {sessionStatus === 'completed' && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 mb-5 flex items-center gap-3">
          <Check className="h-5 w-5 text-green-400 shrink-0" />
          <p className="text-green-400 text-sm font-medium">Sesión completada</p>
        </div>
      )}

      {/* Progress */}
      {(sessionStatus === 'in_progress' || sessionStatus === 'completed') && exercises.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FF914D] rounded-full transition-all"
              style={{ width: `${(savedCount / exercises.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-white/40 shrink-0">{savedCount}/{exercises.length}</span>
        </div>
      )}

      {/* Lista ejercicios */}
      <div className="flex flex-col gap-3 mb-6">
        {exercises.map((exercise, idx) => {
          const form = forms[exercise.id]
          const isExpanded = expandedId === exercise.id
          const isActive = sessionStatus === 'in_progress' || sessionStatus === 'completed'

          return (
            <div
              key={exercise.id}
              className={`bg-[#1C1C1C] rounded-2xl border overflow-hidden transition-colors
                ${form.saved
                  ? 'border-green-500/20'
                  : form.skipped
                    ? 'border-white/5'
                    : 'border-white/10'
                }`}
            >
              {/* Cabecera del ejercicio */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                onClick={() => isActive && setExpandedId(isExpanded ? null : exercise.id)}
                disabled={!isActive}
              >
                <span className="w-6 h-6 rounded-full bg-white/5 text-white/30 text-xs font-bold flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${form.skipped ? 'text-white/30 line-through' : 'text-white'}`}>
                    {exercise.exercises.name}
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">
                    Prescrito: {exercise.sets}×{exercise.reps}
                    {exercise.weight_kg ? ` · ${exercise.weight_kg}kg` : ''}
                  </p>
                </div>
                {form.saved ? (
                  <Check className="h-4 w-4 text-green-400 shrink-0" />
                ) : form.skipped ? (
                  <SkipForward className="h-4 w-4 text-white/20 shrink-0" />
                ) : isActive ? (
                  isExpanded
                    ? <ChevronUp className="h-4 w-4 text-white/30 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-white/30 shrink-0" />
                ) : null}
              </button>

              {/* Formulario expandido */}
              {isExpanded && isActive && (
                <div className="px-4 pb-4 border-t border-white/5">
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <NumericField
                      label="Series realizadas"
                      value={form.sets_done}
                      onChange={v => updateField(exercise.id, 'sets_done', v)}
                      placeholder={exercise.sets.toString()}
                    />
                    <NumericField
                      label="Repeticiones"
                      value={form.reps_done}
                      onChange={v => updateField(exercise.id, 'reps_done', v)}
                      placeholder={exercise.reps.toString()}
                    />
                    <NumericField
                      label="Carga (kg)"
                      value={form.load_kg}
                      onChange={v => updateField(exercise.id, 'load_kg', v)}
                      placeholder={exercise.weight_kg?.toString() ?? '0'}
                      decimal
                    />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-white/50">Esfuerzo (1-10)</label>
                      <div className="flex gap-1 flex-wrap">
                        {[1,2,3,4,5,6,7,8,9,10].map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => updateField(exercise.id, 'effort', n.toString())}
                            className={`w-7 h-7 rounded text-xs font-bold transition-colors
                              ${form.effort === n.toString()
                                ? n <= 3 ? 'bg-green-500 text-white'
                                  : n <= 6 ? 'bg-yellow-500 text-white'
                                  : 'bg-red-500 text-white'
                                : 'bg-white/5 text-white/40 hover:bg-white/10'
                              }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="text-xs text-white/50 block mb-1.5">Comentarios</label>
                    <textarea
                      value={form.notes}
                      onChange={e => updateField(exercise.id, 'notes', e.target.value)}
                      placeholder="Observaciones del entrenador..."
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-white/20"
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        updateField(exercise.id, 'skipped', !form.skipped)
                      }}
                      className={`flex items-center gap-1.5 text-xs transition-colors
                        ${form.skipped ? 'text-[#FF914D]' : 'text-white/30 hover:text-white/50'}`}
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                      {form.skipped ? 'Desmarcar omisión' : 'Omitir ejercicio'}
                    </button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveExercise(exercise)}
                      disabled={saving[exercise.id]}
                      className="bg-[#FF914D] hover:bg-[#e07a3a] text-white text-xs"
                    >
                      {saving[exercise.id] ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Botón completar sesión */}
      {sessionStatus === 'in_progress' && (
        <Button
          onClick={handleComplete}
          disabled={completing || !allSaved}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold py-3"
        >
          {completing ? 'Guardando...' : allSaved ? 'Completar sesión' : `Registra todos los ejercicios (${savedCount}/${exercises.length})`}
        </Button>
      )}
    </div>
  )
}

function NumericField({ label, value, onChange, placeholder, decimal }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  decimal?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-white/50">{label}</label>
      <input
        type="number"
        inputMode={decimal ? 'decimal' : 'numeric'}
        step={decimal ? '0.5' : '1'}
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20"
      />
    </div>
  )
}
