'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createGroupCycleAction, GroupSessionExercise } from '@/app/actions/group-sessions'
import { ExercisePickerModal } from '@/app/dashboard/planes/nuevo/exercise-picker-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Check, Dumbbell, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

type Exercise = {
  id: string; name: string; technical_name: string | null
  level: number | null; technical_level: string | null
  body_zone_id: string | null
  movement_pattern_id: string | null; equipment_id: string | null
  objective_id: string | null; muscle_group_ids: string[]
}
type Item = { id: string; name: string }

interface Props {
  exercises: Exercise[]
  bodyZones: Item[]
  muscleGroups: Item[]
  movementPatterns: Item[]
  equipment: Item[]
  objectives: Item[]
}

type SessionLabel = 'A' | 'B' | 'C'

const SESSION_COLORS: Record<SessionLabel, string> = {
  A: 'bg-blue-500',
  B: 'bg-purple-500',
  C: 'bg-green-500',
}

const SESSION_LABELS: Record<SessionLabel, string> = {
  A: 'Sesión A',
  B: 'Sesión B',
  C: 'Sesión C',
}

export function CycleForm({ exercises, bodyZones, muscleGroups, movementPatterns, equipment, objectives }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [cycleNotes, setCycleNotes] = useState('')

  const [sessionExercises, setSessionExercises] = useState<Record<SessionLabel, GroupSessionExercise[]>>({
    A: [], B: [], C: [],
  })
  const [sessionNotes, setSessionNotes] = useState<Record<SessionLabel, string>>({
    A: '', B: '', C: '',
  })

  // Which session's picker is open
  const [openPicker, setOpenPicker] = useState<SessionLabel | null>(null)

  function addExercise(label: SessionLabel, exercise: Exercise, sets: number, reps: number, weight_kg: string, notes: string) {
    setSessionExercises(prev => ({
      ...prev,
      [label]: [...prev[label], {
        exercise_id: exercise.id,
        sets,
        reps,
        weight_kg: weight_kg ? parseFloat(weight_kg) : undefined,
        notes: notes || undefined,
        order_index: prev[label].length,
      }],
    }))
  }

  function removeExercise(label: SessionLabel, index: number) {
    setSessionExercises(prev => ({
      ...prev,
      [label]: prev[label].filter((_, i) => i !== index).map((ex, i) => ({ ...ex, order_index: i })),
    }))
  }

  function updateExercise(label: SessionLabel, index: number, sets: number, reps: number, weight_kg: string, notes: string) {
    setSessionExercises(prev => {
      const updated = [...prev[label]]
      updated[index] = {
        ...updated[index],
        sets,
        reps,
        weight_kg: weight_kg ? parseFloat(weight_kg) : undefined,
        notes: notes || undefined,
      }
      return { ...prev, [label]: updated }
    })
  }

  function getExerciseName(id: string) {
    return exercises.find(e => e.id === id)?.name ?? id
  }

  async function handleSave() {
    setSaving(true)
    const result = await createGroupCycleAction({
      start_date: startDate,
      notes: cycleNotes || undefined,
      sessions: (['A', 'B', 'C'] as SessionLabel[]).map(label => ({
        label,
        notes: sessionNotes[label] || undefined,
        exercises: sessionExercises[label],
      })),
    })
    setSaving(false)
    if (result.error) { alert(result.error); return }
    setSaved(true)
    setTimeout(() => router.push('/dashboard/sesiones'), 1500)
  }

  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 13)
  const endDateStr = endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

  if (saved) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-white">Ciclo creado correctamente</h2>
          <p className="text-white/50 text-xs mt-2">Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/sesiones" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nuevo ciclo de sesiones</h1>
          <p className="text-white/50 text-sm mt-0.5">Define las 3 sesiones del ciclo de 2 semanas</p>
        </div>
      </div>

      {/* Fecha de inicio */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5 mb-5">
        <h2 className="text-sm font-semibold text-white mb-4">Periodo del ciclo</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-white/60 text-xs">Fecha de inicio</Label>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-white/60 text-xs">Fecha de fin (automática)</Label>
            <div className="flex items-center h-9 px-3 rounded-lg bg-white/5 border border-white/10 text-white/50 text-sm">
              {endDateStr}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <Label className="text-white/60 text-xs">Notas del ciclo (opcional)</Label>
          <Input
            value={cycleNotes}
            onChange={e => setCycleNotes(e.target.value)}
            placeholder="Ej: Ciclo de fuerza — fase 1"
            className="mt-1.5 bg-white/5 border-white/10 text-white placeholder:text-white/20"
          />
        </div>
      </div>

      {/* Las 3 sesiones */}
      <div className="flex flex-col gap-4 mb-6">
        {(['A', 'B', 'C'] as SessionLabel[]).map(label => {
          const exList = sessionExercises[label]
          return (
            <div key={label} className="bg-[#1C1C1C] rounded-2xl border border-white/10 overflow-hidden">
              {/* Session header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
                <span className={`w-7 h-7 rounded-full ${SESSION_COLORS[label]} text-white text-sm font-bold flex items-center justify-center shrink-0`}>
                  {label}
                </span>
                <span className="font-semibold text-white flex-1">{SESSION_LABELS[label]}</span>
                <span className="text-white/30 text-xs">{exList.length} ejercicio{exList.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="p-5">
                {/* Notes */}
                <div className="mb-4">
                  <Input
                    value={sessionNotes[label]}
                    onChange={e => setSessionNotes(prev => ({ ...prev, [label]: e.target.value }))}
                    placeholder="Notas de la sesión (opcional)"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-sm"
                  />
                </div>

                {/* Exercise list */}
                {exList.length > 0 && (
                  <div className="flex flex-col gap-2 mb-4">
                    {exList.map((ex, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2.5">
                        <Dumbbell className="h-3.5 w-3.5 text-white/30 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{getExerciseName(ex.exercise_id)}</p>
                          <p className="text-xs text-white/40">
                            {ex.sets}×{ex.reps}
                            {ex.weight_kg ? ` · ${ex.weight_kg}kg` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExercise(label, i)}
                          className="text-white/20 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setOpenPicker(label)}
                  className="flex items-center gap-2 text-sm text-[#FF914D] hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir ejercicio
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Save */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold flex-1"
        >
          {saving ? 'Guardando...' : 'Guardar ciclo'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>

      {/* Exercise picker modal (one per session, opened on demand) */}
      {openPicker && (
        <ExercisePickerModal
          exercises={exercises}
          exerciseCatalog={exercises}
          existingExercises={sessionExercises[openPicker]}
          bodyZones={bodyZones}
          movementPatterns={movementPatterns}
          muscleGroups={muscleGroups}
          equipment={equipment}
          objectives={objectives}
          dayLabel={`Sesión ${openPicker}`}
          onAdd={(exercise, sets, reps, weight_kg, notes) => {
            addExercise(openPicker, exercise, sets, reps, weight_kg, notes)
          }}
          onRemove={(index) => removeExercise(openPicker, index)}
          onUpdate={(index, sets, reps, weight_kg, notes) => updateExercise(openPicker, index, sets, reps, weight_kg, notes)}
          onClose={() => setOpenPicker(null)}
        />
      )}
    </div>
  )
}
