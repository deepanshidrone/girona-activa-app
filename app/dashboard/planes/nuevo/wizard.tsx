'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPlanAction, PlanDay, PlanExercise } from '@/app/actions/plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import Link from 'next/link'

type Client = { id: string; first_name: string; last_name: string }
type Exercise = { id: string; name: string; level: number | null; technical_level: string | null; movement_pattern_id: string | null }
type Item = { id: string; name: string }

interface Props {
  clients: Client[]
  exercises: Exercise[]
  muscleGroups: Item[]
  movementPatterns: Item[]
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

export function PlanWizard({ clients, exercises, muscleGroups, movementPatterns }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Form state
  const [clientId, setClientId] = useState('')
  const [level, setLevel] = useState<number | null>(null)
  const [durationMonths, setDurationMonths] = useState(1)
  const [weeklyFreq, setWeeklyFreq] = useState(3)
  const [sessionDuration, setSessionDuration] = useState<30 | 60>(60)
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([])
  const [planDays, setPlanDays] = useState<PlanDay[]>([])

  // Day editor state
  const [editingDay, setEditingDay] = useState<string | null>(null)
  const [exFilter, setExFilter] = useState('')
  const [addingEx, setAddingEx] = useState<Exercise | null>(null)
  const [exForm, setExForm] = useState({ sets: 3, reps: 10, weight_kg: '', notes: '' })

  const selectedClient = clients.find(c => c.id === clientId)

  // Step 4 → 5: generate calendar
  function handleGenerateCalendar() {
    const dates = generatePlanDates(startDate, durationMonths, selectedWeekdays)
    setPlanDays(dates.map(date => ({ date, exercises: [] })))
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

  function addExerciseToDay(date: string, exercise: Exercise) {
    const sets = exForm.sets
    const reps = exForm.reps
    const weight_kg = exForm.weight_kg ? parseFloat(exForm.weight_kg) : undefined
    const notes = exForm.notes || undefined

    setPlanDays(planDays.map(d => {
      if (d.date !== date) return d
      return {
        ...d,
        exercises: [...d.exercises, {
          exercise_id: exercise.id,
          sets,
          reps,
          weight_kg,
          notes,
          order_index: d.exercises.length,
        }]
      }
    }))
    setAddingEx(null)
    setExForm({ sets: 3, reps: 10, weight_kg: '', notes: '' })
  }

  function removeExerciseFromDay(date: string, index: number) {
    setPlanDays(planDays.map(d => {
      if (d.date !== date) return d
      return { ...d, exercises: d.exercises.filter((_, i) => i !== index) }
    }))
  }

  async function handleSave() {
    setSaving(true)
    const result = await createPlanAction({
      client_id: clientId,
      level: level!,
      duration_months: durationMonths,
      weekly_frequency: weeklyFreq,
      session_duration: sessionDuration,
      start_date: startDate,
      days: planDays,
    })
    setSaving(false)
    if (result.error) { alert(result.error); return }
    setSaved(true)
    setTimeout(() => router.push('/dashboard/planes'), 1500)
  }

  const filteredExercises = exercises.filter(ex =>
    ex.name.toLowerCase().includes(exFilter.toLowerCase())
  )

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
          <h1 className="text-2xl font-bold text-[#1C1C1C]">Nuevo plan de entrenamiento</h1>
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

      {/* STEP 2 — Tipo (solo individual en MVP) */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
          <h2 className="text-lg font-bold text-[#1C1C1C] mb-4">Tipo de entrenamiento</h2>
          <div className="grid grid-cols-2 gap-3">
            {[{ val: 'individual', label: 'Individual', desc: 'Plan personalizado día a día' },
              { val: 'group', label: 'Grupal', desc: 'Plantilla predefinida por nivel', disabled: true }
            ].map(t => (
              <button
                key={t.val}
                disabled={t.disabled}
                onClick={() => !t.disabled && setStep(3)}
                className={`p-4 rounded-xl border text-left transition-colors ${
                  t.val === 'individual' ? 'border-[#FF914D] bg-orange-50' : 'border-[#E5E5E5] opacity-40 cursor-not-allowed'
                }`}
              >
                <p className="font-semibold text-[#1C1C1C]">{t.label}</p>
                <p className="text-xs text-[#666666] mt-0.5">{t.desc}</p>
                {t.disabled && <span className="text-xs text-[#FF914D]">Próximamente</span>}
              </button>
            ))}
          </div>
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
          <p className="text-[#666666] text-sm mb-5">Para <strong>{selectedClient?.first_name} {selectedClient?.last_name}</strong></p>
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
              disabled={selectedWeekdays.length !== weeklyFreq}
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
                  {' · '}Nivel {level} · {durationMonths} mes{durationMonths > 1 ? 'es' : ''} · {weeklyFreq}x semana · {sessionDuration} min
                </p>
                <p className="text-xs text-[#666666] mt-0.5">{planDays.length} sesiones en total</p>
              </div>
              <Button variant="outline" onClick={() => setStep(4)} className="text-sm">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Editar
              </Button>
            </div>
          </div>

          {/* Calendarios por mes */}
          {getMonthsInRange(startDate, durationMonths).map(({ year, month }) => (
            <MonthCalendar
              key={`${year}-${month}`}
              year={year}
              month={month}
              planDays={planDays}
              onToggleDay={toggleDay}
              onEditDay={setEditingDay}
            />
          ))}

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

      {/* PANEL LATERAL — Editor de día */}
      {editingDay && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => { setEditingDay(null); setAddingEx(null) }} />
          <div className="w-full max-w-md bg-white h-full overflow-y-auto flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
              <div>
                <h3 className="font-bold text-[#1C1C1C]">
                  {new Date(editingDay + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <p className="text-xs text-[#666666]">{getDayExercises(editingDay).length} ejercicio{getDayExercises(editingDay).length !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => { setEditingDay(null); setAddingEx(null) }} className="text-[#666666] hover:text-[#1C1C1C]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 p-5 flex flex-col gap-4">
              {/* Lista ejercicios del día */}
              {getDayExercises(editingDay).length > 0 && (
                <div className="flex flex-col gap-2">
                  {getDayExercises(editingDay).map((ex, i) => {
                    const exData = exercises.find(e => e.id === ex.exercise_id)
                    return (
                      <div key={i} className="flex items-center gap-3 bg-[#F5F5F5] rounded-xl px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#1C1C1C] truncate">{exData?.name}</p>
                          <p className="text-xs text-[#666666]">
                            {ex.sets} series × {ex.reps} reps
                            {ex.weight_kg ? ` · ${ex.weight_kg} kg` : ''}
                          </p>
                        </div>
                        <button onClick={() => removeExerciseFromDay(editingDay, i)} className="text-[#666666] hover:text-red-500 shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Formulario agregar ejercicio */}
              {addingEx ? (
                <div className="bg-orange-50 border border-[#FF914D]/30 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-[#1C1C1C]">{addingEx.name}</p>
                    <button onClick={() => setAddingEx(null)} className="text-[#666666] hover:text-[#1C1C1C]">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Series</Label>
                      <Input type="number" value={exForm.sets} onChange={e => setExForm({ ...exForm, sets: parseInt(e.target.value) || 1 })} min={1} max={10} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Repeticiones</Label>
                      <Input type="number" value={exForm.reps} onChange={e => setExForm({ ...exForm, reps: parseInt(e.target.value) || 1 })} min={1} max={100} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Peso (kg) — opcional</Label>
                    <Input type="number" value={exForm.weight_kg} onChange={e => setExForm({ ...exForm, weight_kg: e.target.value })} placeholder="Ej: 60" step={0.5} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Notas — opcional</Label>
                    <Input value={exForm.notes} onChange={e => setExForm({ ...exForm, notes: e.target.value })} placeholder="Indicaciones..." />
                  </div>
                  <Button onClick={() => addExerciseToDay(editingDay, addingEx)} className="bg-[#FF914D] hover:bg-[#e07a3a] text-white w-full">
                    <Plus className="h-4 w-4 mr-1.5" /> Agregar al día
                  </Button>
                </div>
              ) : (
                <>
                  {/* Buscador de ejercicios */}
                  <div>
                    <p className="text-sm font-medium text-[#1C1C1C] mb-2">Agregar ejercicio</p>
                    <Input
                      placeholder="Buscar ejercicio..."
                      value={exFilter}
                      onChange={e => setExFilter(e.target.value)}
                      className="mb-2"
                    />
                    <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
                      {filteredExercises.map(ex => (
                        <button
                          key={ex.id}
                          onClick={() => { setAddingEx(ex); setExForm({ sets: 3, reps: 10, weight_kg: '', notes: '' }) }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-[#F5F5F5] transition-colors"
                        >
                          <span className="text-sm text-[#1C1C1C] flex-1">{ex.name}</span>
                          {ex.level && <span className="text-xs text-[#666666] bg-[#F5F5F5] px-1.5 py-0.5 rounded">Niv.{ex.level}</span>}
                          <Plus className="h-3.5 w-3.5 text-[#FF914D] shrink-0" />
                        </button>
                      ))}
                      {filteredExercises.length === 0 && (
                        <p className="text-sm text-[#666666] text-center py-4">No hay ejercicios con ese nombre</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
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
