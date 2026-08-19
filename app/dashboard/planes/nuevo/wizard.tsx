'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPlanAction, PlanDay, PlanExercise } from '@/app/actions/plans'
import { createGroupPlanAction } from '@/app/actions/group-sessions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { ExercisePickerModal } from './exercise-picker-modal'

type Client = { id: string; first_name: string; last_name: string }
type Exercise = {
  id: string; name: string; technical_name: string | null
  level: number | null; technical_level: string | null
  body_zone_id: string | null
  movement_pattern_id: string | null; equipment_id: string | null
  objective_id: string | null; muscle_group_ids: string[]
}
type Item = { id: string; name: string }
type Cycle = { id: string; start_date: string; notes: string | null }
type GroupDay = { date: string; session_label: 'A' | 'B' | 'C' }

const SESSION_LABEL_COLORS = { A: 'bg-blue-500', B: 'bg-purple-500', C: 'bg-green-500' }

function getSessionLabel(index: number): 'A' | 'B' | 'C' {
  return (['A', 'B', 'C'] as const)[index % 3]
}

interface Props {
  clients: Client[]
  exercises: Exercise[]
  bodyZones: Item[]
  muscleGroups: Item[]
  movementPatterns: Item[]
  equipment: Item[]
  objectives: Item[]
  cycles: Cycle[]
}

const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function generatePlanDates(startDate: string, months: number, weekdays: number[]): string[] {
  const dates: string[] = []
  const start = new Date(startDate)
  const end = new Date(startDate)
  end.setMonth(end.getMonth() + months)

  const current = new Date(start)
  while (current < end) {
    const dow = (current.getDay() + 6) % 7 // Monday=0
    if (weekdays.includes(dow)) {
      dates.push(current.toISOString().split('T')[0])
    }
    current.setDate(current.getDate() + 1)
  }
  return dates
}

function getMonthsInRange(startDate: string, months: number): { year: number; month: number }[] {
  const result = []
  const start = new Date(startDate)
  for (let i = 0; i < months; i++) {
    const d = new Date(start)
    d.setMonth(d.getMonth() + i)
    result.push({ year: d.getFullYear(), month: d.getMonth() })
  }
  return result
}

export function PlanWizard({ clients, exercises, bodyZones, muscleGroups, movementPatterns, equipment, objectives, cycles }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Form state
  const [clientId, setClientId] = useState('')
  const [planType, setPlanType] = useState<'individual' | 'group'>('individual')
  const [selectedCycleId, setSelectedCycleId] = useState<string>('')
  const [level, setLevel] = useState<number | null>(null)
  const [groupDays, setGroupDays] = useState<GroupDay[]>([])
  const [durationMonths, setDurationMonths] = useState(1)
  const [weeklyFreq, setWeeklyFreq] = useState(3)
  const [sessionDuration, setSessionDuration] = useState<30 | 60>(60)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([])
  const [planDays, setPlanDays] = useState<PlanDay[]>([])

  // Day editor state
  const [editingDay, setEditingDay] = useState<string | null>(null)

  const selectedClient = clients.find(c => c.id === clientId)

  // Step 4 → 5: generate calendar
  function handleGenerateCalendar() {
    const dates = generatePlanDates(startDate, durationMonths, selectedWeekdays)
    if (planType === 'group') {
      setGroupDays(dates.map((date, i) => ({ date, session_label: getSessionLabel(i) })))
    } else {
      setPlanDays(dates.map(date => ({ date, exercises: [] })))
    }
    setStep(5)
  }

  function toggleWeekday(dow: number) {
    if (selectedWeekdays.includes(dow)) {
      setSelectedWeekdays(selectedWeekdays.filter(d => d !== dow))
    } else if (selectedWeekdays.length < weeklyFreq) {
      setSelectedWeekdays([...selectedWeekdays, dow].sort((a, b) => a - b))
    }
  }

  function toggleDay(date: string) {
    if (planDays.find(d => d.date === date)) {
      setPlanDays(planDays.filter(d => d.date !== date))
    } else {
      setPlanDays([...planDays, { date, exercises: [] }].sort((a, b) => a.date.localeCompare(b.date)))
    }
  }

  function getDayExercises(date: string) {
    return planDays.find(d => d.date === date)?.exercises ?? []
  }

  function addExerciseToDay(date: string, exercise: Exercise, sets: number, reps: number, weight_kg: string, notes: string) {
    setPlanDays(prev => prev.map(d => {
      if (d.date !== date) return d
      return {
        ...d,
        exercises: [...d.exercises, {
          exercise_id: exercise.id,
          sets,
          reps,
          weight_kg: weight_kg ? parseFloat(weight_kg) : undefined,
          notes: notes || undefined,
          order_index: d.exercises.length,
        }]
      }
    }))
  }

  function removeExerciseFromDay(date: string, index: number) {
    setPlanDays(planDays.map(d => {
      if (d.date !== date) return d
      return { ...d, exercises: d.exercises.filter((_, i) => i !== index) }
    }))
  }

  function updateExerciseInDay(date: string, index: number, sets: number, reps: number, weight_kg: string, notes: string) {
    setPlanDays(prev => prev.map(d => {
      if (d.date !== date) return d
      const updated = [...d.exercises]
      updated[index] = {
        ...updated[index],
        sets,
        reps,
        weight_kg: weight_kg ? parseFloat(weight_kg) : undefined,
        notes: notes || undefined,
      }
      return { ...d, exercises: updated }
    }))
  }

  async function handleSave() {
    setSaving(true)
    let result: { error?: string; success?: boolean }
    if (planType === 'group') {
      result = await createGroupPlanAction({
        client_id: clientId,
        level: level ?? 1,
        duration_months: durationMonths,
        weekly_frequency: weeklyFreq,
        session_duration: sessionDuration,
        start_date: startDate,
        cycle_id: selectedCycleId,
        training_dates: groupDays,
      })
    } else {
      result = await createPlanAction({
        client_id: clientId,
        level: level!,
        duration_months: durationMonths,
        weekly_frequency: weeklyFreq,
        session_duration: sessionDuration,
        start_date: startDate,
        days: planDays,
      })
    }
    setSaving(false)
    if (result.error) { alert(result.error); return }
    setSaved(true)
    setTimeout(() => router.push('/dashboard/planes'), 1500)
  }

  if (saved) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-[#1C1C1C]">Plan creado correctamente</h2>
          <p className="text-[#666666] text-xs mt-2">Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/planes" className="text-[#666666] hover:text-[#1C1C1C]">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nuevo plan de entrenamiento</h1>
          <p className="text-[#666666] text-sm mt-0.5">Paso {step} de 5</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1 mb-8">
        {[1, 2, 3, 4, 5].map(s => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[#FF914D]' : 'bg-[#E5E5E5]'}`} />
        ))}
      </div>

      {/* STEP 1 — Cliente */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
          <h2 className="text-lg font-bold text-[#1C1C1C] mb-4">Selecciona el cliente</h2>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {clients.map(c => (
              <button
                key={c.id}
                onClick={() => setClientId(c.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                  clientId === c.id ? 'border-[#FF914D] bg-orange-50' : 'border-[#E5E5E5] hover:border-[#FF914D]/50'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[#FF914D]/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-[#FF914D]">{c.first_name[0]}{c.last_name[0]}</span>
                </div>
                <span className="font-medium text-[#1C1C1C]">{c.first_name} {c.last_name}</span>
                {clientId === c.id && <Check className="h-4 w-4 text-[#FF914D] ml-auto" />}
              </button>
            ))}
          </div>
          <div className="flex justify-end mt-6">
            <Button onClick={() => setStep(2)} disabled={!clientId} className="bg-[#FF914D] hover:bg-[#e07a3a] text-white gap-2">
              Siguiente <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 — Tipo */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
          <h2 className="text-lg font-bold text-[#1C1C1C] mb-4">Tipo de entrenamiento</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setPlanType('individual'); setStep(3) }}
              className={`p-4 rounded-xl border text-left transition-colors ${
                planType === 'individual' ? 'border-[#FF914D] bg-orange-50' : 'border-[#E5E5E5] hover:border-[#FF914D]/50'
              }`}
            >
              <p className="font-semibold text-[#1C1C1C]">Individual</p>
              <p className="text-xs text-[#666666] mt-0.5">Plan personalizado día a día</p>
            </button>
            <button
              onClick={() => { setPlanType('group'); setStep(3) }}
              disabled={cycles.length === 0}
              className={`p-4 rounded-xl border text-left transition-colors ${
                cycles.length === 0 ? 'border-[#E5E5E5] opacity-50 cursor-not-allowed' : planType === 'group' ? 'border-[#FF914D] bg-orange-50' : 'border-[#E5E5E5] hover:border-[#FF914D]/50'
              }`}
            >
              <p className="font-semibold text-[#1C1C1C]">Grupal</p>
              <p className="text-xs text-[#666666] mt-0.5">Sesiones A / B / C predefinidas</p>
              {cycles.length === 0 && (
                <Link href="/dashboard/sesiones/nuevo" onClick={e => e.stopPropagation()} className="text-xs text-[#FF914D] hover:underline mt-1 block">
                  Crear ciclo primero →
                </Link>
              )}
            </button>
          </div>
          {/* Cycle selector when group is chosen */}
          {planType === 'group' && cycles.length > 0 && (
            <div className="mt-4">
              <Label className="text-xs text-[#666666] mb-2 block">Ciclo a usar</Label>
              <div className="flex flex-col gap-2">
                {cycles.map(c => {
                  const end = new Date(c.start_date); end.setDate(end.getDate() + 13)
                  const fmt = (d: Date) => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCycleId(c.id)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${
                        selectedCycleId === c.id ? 'border-[#FF914D] bg-orange-50' : 'border-[#E5E5E5] hover:border-[#FF914D]/50'
                      }`}
                    >
                      <span className="font-medium text-[#1C1C1C]">{fmt(new Date(c.start_date))} — {fmt(end)}</span>
                      {c.notes && <span className="text-xs text-[#666666] ml-2">{c.notes}</span>}
                      {selectedCycleId === c.id && <Check className="h-4 w-4 text-[#FF914D] float-right mt-0.5" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Atrás
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3 — Nivel */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
          <h2 className="text-lg font-bold text-[#1C1C1C] mb-1">Nivel del cliente</h2>
          <p className="text-[#666666] text-sm mb-1">Para <strong>{selectedClient?.first_name} {selectedClient?.last_name}</strong></p>
          {planType === 'group' && (
            <p className="text-xs text-[#FF914D] mb-5">Los ejercicios de las sesiones A/B/C son los mismos para todos los niveles — el nivel determina los pesos y repeticiones.</p>
          )}
          {planType === 'individual' && <div className="mb-4" />}
          <div className="grid grid-cols-3 gap-3">
            {[
              { val: 1, label: 'Nivel 1', desc: 'Sin experiencia previa' },
              { val: 2, label: 'Nivel 2', desc: 'Experiencia básica-intermedia' },
              { val: 3, label: 'Nivel 3', desc: 'Experiencia avanzada' },
            ].map(n => (
              <button
                key={n.val}
                onClick={() => setLevel(n.val)}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  level === n.val ? 'border-[#FF914D] bg-orange-50' : 'border-[#E5E5E5] hover:border-[#FF914D]/50'
                }`}
              >
                <p className="font-bold text-2xl text-[#FF914D]">{n.val}</p>
                <p className="font-semibold text-[#1C1C1C] text-sm mt-1">{n.label}</p>
                <p className="text-xs text-[#666666] mt-0.5">{n.desc}</p>
              </button>
            ))}
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Atrás
            </Button>
            <Button onClick={() => setStep(4)} disabled={!level} className="bg-[#FF914D] hover:bg-[#e07a3a] text-white gap-2">
              Siguiente <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 4 — Parámetros + días de la semana */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
          <h2 className="text-lg font-bold text-[#1C1C1C] mb-5">Parámetros del ciclo</h2>
          <div className="flex flex-col gap-5">

            {/* Fecha inicio */}
            <div className="flex flex-col gap-1.5">
              <Label>Fecha de inicio</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="max-w-xs" />
            </div>

            {/* Duración */}
            <div className="flex flex-col gap-1.5">
              <Label>Duración (meses)</Label>
              <div className="flex gap-2">
                {[1, 2, 3].map(m => (
                  <button key={m} onClick={() => setDurationMonths(m)}
                    className={`w-14 py-2 rounded-lg text-sm font-medium transition-colors ${durationMonths === m ? 'bg-[#FF914D] text-white' : 'bg-[#F5F5F5] text-[#1C1C1C] hover:bg-[#E5E5E5]'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Frecuencia semanal */}
            <div className="flex flex-col gap-1.5">
              <Label>Frecuencia semanal (días)</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(f => (
                  <button key={f} onClick={() => { setWeeklyFreq(f); setSelectedWeekdays([]) }}
                    className={`w-10 py-2 rounded-lg text-sm font-medium transition-colors ${weeklyFreq === f ? 'bg-[#FF914D] text-white' : 'bg-[#F5F5F5] text-[#1C1C1C] hover:bg-[#E5E5E5]'}`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Días de la semana */}
            <div className="flex flex-col gap-1.5">
              <Label>Días de entrenamiento <span className="text-[#666666] font-normal">(selecciona {weeklyFreq})</span></Label>
              <div className="flex gap-2 flex-wrap">
                {WEEKDAYS.map((day, i) => (
                  <button key={i} onClick={() => toggleWeekday(i)}
                    disabled={!selectedWeekdays.includes(i) && selectedWeekdays.length >= weeklyFreq}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedWeekdays.includes(i) ? 'bg-[#FF914D] text-white' : 'bg-[#F5F5F5] text-[#1C1C1C] hover:bg-[#E5E5E5] disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}>
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
              {selectedWeekdays.length > 0 && (
                <p className="text-xs text-[#666666]">
                  Días seleccionados: {selectedWeekdays.map(d => WEEKDAYS[d]).join(', ')}
                </p>
              )}
            </div>

            {/* Duración sesión */}
            <div className="flex flex-col gap-1.5">
              <Label>Duración por sesión</Label>
              <div className="flex gap-2">
                {[30, 60].map(d => (
                  <button key={d} onClick={() => setSessionDuration(d as 30 | 60)}
                    className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${sessionDuration === d ? 'bg-[#FF914D] text-white' : 'bg-[#F5F5F5] text-[#1C1C1C] hover:bg-[#E5E5E5]'}`}>
                    {d} min
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep(3)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Atrás
            </Button>
            <Button
              onClick={handleGenerateCalendar}
              disabled={selectedWeekdays.length !== weeklyFreq || (planType === 'group' && !selectedCycleId)}
              className="bg-[#FF914D] hover:bg-[#e07a3a] text-white gap-2"
            >
              Generar calendario <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5 — Calendario */}
      {step === 5 && (
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#666666]">
                  <strong className="text-[#1C1C1C]">{selectedClient?.first_name} {selectedClient?.last_name}</strong>
                  {' · '}{planType === 'group' ? 'Grupal' : `Nivel ${level}`} · {durationMonths} mes{durationMonths > 1 ? 'es' : ''} · {weeklyFreq}x semana · {sessionDuration} min
                </p>
                <p className="text-xs text-[#666666] mt-0.5">
                  {planType === 'group' ? groupDays.length : planDays.length} sesiones en total
                  {planType === 'group' && ' (A/B/C rotación)'}
                </p>
              </div>
              <Button variant="outline" onClick={() => setStep(4)} className="text-sm">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Editar
              </Button>
            </div>
            {planType === 'group' && (
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-[#E5E5E5]">
                {(['A', 'B', 'C'] as const).map(l => (
                  <div key={l} className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 rounded-full ${SESSION_LABEL_COLORS[l]} text-white text-[9px] font-bold flex items-center justify-center`}>{l}</span>
                    <span className="text-xs text-[#666666]">Sesión {l} ({groupDays.filter(d => d.session_label === l).length})</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Calendarios por mes */}
          {planType === 'group'
            ? getMonthsInRange(startDate, durationMonths).map(({ year, month }) => (
                <GroupMonthCalendar
                  key={`${year}-${month}`}
                  year={year}
                  month={month}
                  groupDays={groupDays}
                />
              ))
            : getMonthsInRange(startDate, durationMonths).map(({ year, month }) => (
                <MonthCalendar
                  key={`${year}-${month}`}
                  year={year}
                  month={month}
                  planDays={planDays}
                  onToggleDay={toggleDay}
                  onEditDay={setEditingDay}
                />
              ))
          }

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(4)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Atrás
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#FF914D] hover:bg-[#e07a3a] text-white gap-2"
            >
              {saving ? 'Guardando...' : 'Guardar plan'} {!saving && <Check className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      {/* MODAL — Selector de ejercicio */}
      {editingDay && (
        <ExercisePickerModal
          exercises={exercises}
          bodyZones={bodyZones}
          movementPatterns={movementPatterns}
          muscleGroups={muscleGroups}
          equipment={equipment}
          objectives={objectives}
          existingExercises={getDayExercises(editingDay)}
          exerciseCatalog={exercises}
          dayLabel={new Date(editingDay + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          onAdd={(exercise, sets, reps, weight_kg, notes) => {
            addExerciseToDay(editingDay, exercise, sets, reps, weight_kg, notes)
          }}
          onRemove={(index) => removeExerciseFromDay(editingDay, index)}
          onUpdate={(index, sets, reps, weight_kg, notes) => {
            updateExerciseInDay(editingDay, index, sets, reps, weight_kg, notes)
          }}
          onClose={() => setEditingDay(null)}
        />
      )}
    </div>
  )
}

// Calendario para plan grupal (muestra A/B/C)
function GroupMonthCalendar({ year, month, groupDays }: {
  year: number; month: number; groupDays: GroupDay[]
}) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7

  const dayMap = new Map(groupDays.map(d => [d.date, d.session_label]))

  const cells: (number | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5">
      <h3 className="font-bold text-[#1C1C1C] mb-4">{MONTHS_ES[month]} {year}</h3>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-[#666666] py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const label = dayMap.get(dateStr)
          return (
            <div key={i} className="relative aspect-square">
              <div className={`w-full h-full rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm font-medium
                ${label ? 'text-white' : 'text-[#1C1C1C]'}`}
                style={label ? { backgroundColor: label === 'A' ? '#3b82f6' : label === 'B' ? '#a855f7' : '#22c55e' } : {}}
              >
                <span>{day}</span>
                {label && <span className="text-[9px] font-bold opacity-90">{label}</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#E5E5E5]">
        {(['A', 'B', 'C'] as const).map(l => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: l === 'A' ? '#3b82f6' : l === 'B' ? '#a855f7' : '#22c55e' }} />
            <span className="text-xs text-[#666666]">Sesión {l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Componente calendario mensual
function MonthCalendar({ year, month, planDays, onToggleDay, onEditDay }: {
  year: number
  month: number
  planDays: PlanDay[]
  onToggleDay: (date: string) => void
  onEditDay: (date: string) => void
}) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // Monday=0

  const planDates = new Set(planDays.map(d => d.date))
  const daysWithExercises = new Set(planDays.filter(d => d.exercises.length > 0).map(d => d.date))

  const cells: (number | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5">
      <h3 className="font-bold text-[#1C1C1C] mb-4">
        {MONTHS_ES[month]} {year}
      </h3>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-[#666666] py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const isTraining = planDates.has(dateStr)
          const hasEx = daysWithExercises.has(dateStr)

          return (
            <div key={i} className="relative aspect-square">
              <button
                onClick={() => isTraining ? onEditDay(dateStr) : onToggleDay(dateStr)}
                className={`w-full h-full rounded-lg text-sm font-medium transition-all flex flex-col items-center justify-center gap-0.5
                  ${isTraining
                    ? hasEx
                      ? 'bg-[#FF914D] text-white shadow-sm'
                      : 'bg-orange-100 text-[#FF914D] border border-[#FF914D]'
                    : 'text-[#1C1C1C] hover:bg-[#F5F5F5]'
                  }`}
              >
                {day}
                {isTraining && hasEx && (
                  <span className="text-[8px] opacity-80">{planDays.find(d => d.date === dateStr)?.exercises.length} ej.</span>
                )}
              </button>
            </div>
          )
        })}
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#E5E5E5]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-100 border border-[#FF914D]" />
          <span className="text-xs text-[#666666]">Día de entreno (sin ejercicios)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-[#FF914D]" />
          <span className="text-xs text-[#666666]">Con ejercicios</span>
        </div>
      </div>
    </div>
  )
}
