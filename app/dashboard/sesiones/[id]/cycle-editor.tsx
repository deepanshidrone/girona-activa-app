'use client'

import { useState, useTransition, useOptimistic, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Pencil, Trash2, Plus, Search, X, User, Users, Check,
  Calendar, Dumbbell, ChevronRight,
} from 'lucide-react'
import {
  updateGroupSessionExerciseAction,
  addGroupSessionExerciseAction,
  deleteGroupSessionExerciseAction,
  swapGroupSessionExerciseAction,
  updateSlotAssignmentAction,
} from '@/app/actions/group-sessions'
import { toggleHolidayAction } from '@/app/actions/holidays'
import { generateCycleDates } from '@/lib/calendar-utils'

// ─── Types ────────────────────────────────────────────────────────────────────
type Exercise = { id: string; name: string; technical_name?: string | null }
type Employee = { id: string; full_name: string }
type Client   = { id: string; first_name: string; last_name: string }

type SlotClient = { client_id: string; clients: { id: string; first_name: string; last_name: string } }
type Slot = {
  id: string
  day_index: number
  session_time: string
  block_label: string
  max_clients: number
  assigned_employee_id: string | null
  group_cycle_slot_clients: SlotClient[]
}

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
  group_cycle_slots: Slot[]
}

type Holiday = {
  date: string
  name: string
  scope: string
  is_active: boolean
  is_override: boolean
}

type Props = {
  cycle: Cycle
  exercises: Exercise[]
  employees: Employee[]
  clients: Client[]
  holidays: Holiday[]
}

// ─── Constants ────────────────────────────────────────────────────────────────
const DIFF_META = {
  regression:  { label: 'Regressió',  color: 'text-blue-400',   border: 'border-blue-400/20',   bg: 'bg-blue-400/5',   dot: 'bg-blue-400'   },
  base:        { label: 'Base',       color: 'text-[#FF914D]',  border: 'border-[#FF914D]/20',  bg: 'bg-[#FF914D]/5',  dot: 'bg-[#FF914D]'  },
  progression: { label: 'Progressió', color: 'text-purple-400', border: 'border-purple-400/20', bg: 'bg-purple-400/5', dot: 'bg-purple-400' },
} as const

const BLOCK_COLORS: Record<string, string> = { A: 'bg-[#FF914D]', B: 'bg-blue-500', C: 'bg-purple-500' }
const DAY_NAMES  = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres']
const DAY_SHORT  = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeRange(time: string): string {
  // "07:00:00" or "07:00" → "07:00–08:00"
  const [h, m] = time.split(':').map(Number)
  const endH = (h + 1) % 24
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}–${pad(endH)}:${pad(m)}`
}

function formatDateRange(startDate: string) {
  const start = new Date(startDate)
  const end   = new Date(startDate)
  end.setDate(end.getDate() + 27)
  const fmt = (d: Date) => d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })
  return `${fmt(start)} — ${fmt(end)}`
}

function getCycleStatus(startDate: string): { label: string; color: string } {
  const start = new Date(startDate)
  const end   = new Date(startDate)
  end.setDate(end.getDate() + 28)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (today < start) return { label: 'Pròxim', color: 'text-blue-400 bg-blue-400/10' }
  if (today >= start && today < end) return { label: 'Actiu', color: 'text-green-400 bg-green-400/10' }
  return { label: 'Expirat', color: 'text-white/30 bg-white/5' }
}

function getDayDate(startDate: string, day_index: number): Date {
  const d = new Date(startDate + 'T12:00:00')
  d.setDate(d.getDate() + Math.floor(day_index / 5) * 7 + (day_index % 5))
  return d
}

// ─── Exercise picker modal ────────────────────────────────────────────────────
function ExercisePicker({ exercises, onSelect, onClose }: {
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
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Cerca exercici..."
            className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF914D]/50" />
        </div>
        <div className="max-h-72 overflow-y-auto flex flex-col gap-1">
          {filtered.length === 0 && <p className="text-white/30 text-sm text-center py-4">Sense resultats</p>}
          {filtered.map(ex => (
            <button key={ex.id} onClick={() => { onSelect(ex); onClose() }}
              className="flex flex-col items-start px-3 py-2 rounded-xl hover:bg-white/5 text-left">
              <span className="text-white text-sm">{ex.name}</span>
              {ex.technical_name && <span className="text-white/30 text-xs">{ex.technical_name}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Single exercise row (editable) ──────────────────────────────────────────
function ExerciseRow({ gse, onUpdate, onDelete, onSwap }: {
  gse: GSE
  onUpdate: (id: string, data: Partial<Pick<GSE, 'sets' | 'reps' | 'weight_kg'>>) => void
  onDelete: (id: string) => void
  onSwap:   (id: string) => void
}) {
  const [sets,   setSets]   = useState(String(gse.sets))
  const [reps,   setReps]   = useState(String(gse.reps))
  const [weight, setWeight] = useState(gse.weight_kg != null ? String(gse.weight_kg) : '')

  const inputCls = 'w-11 bg-black/40 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-white text-center focus:outline-none focus:border-[#FF914D]/60'

  return (
    <div className="flex items-center gap-2 py-2 border-b border-white/[0.06] last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{gse.exercises?.name ?? '—'}</p>
        {gse.exercises?.technical_name && (
          <p className="text-white/30 text-[10px] truncate">{gse.exercises.technical_name}</p>
        )}
      </div>
      {/* Sets */}
      <input className={inputCls} value={sets} title="Sèries"
        onChange={e => setSets(e.target.value)}
        onBlur={() => { const v = parseInt(sets); if (!isNaN(v) && v > 0) onUpdate(gse.id, { sets: v }) }} />
      <span className="text-white/20 text-xs shrink-0">×</span>
      {/* Reps */}
      <input className={inputCls} value={reps} title="Reps"
        onChange={e => setReps(e.target.value)}
        onBlur={() => { const v = parseInt(reps); if (!isNaN(v) && v > 0) onUpdate(gse.id, { reps: v }) }} />
      {/* Weight */}
      <input className="w-14 bg-black/40 border border-white/10 rounded-lg px-1.5 py-1 text-xs text-white text-center focus:outline-none focus:border-[#FF914D]/60"
        value={weight} placeholder="kg" title="Càrrega"
        onChange={e => setWeight(e.target.value)}
        onBlur={() => { const v = weight === '' ? null : parseFloat(weight); onUpdate(gse.id, { weight_kg: v }) }} />
      <button onClick={() => onSwap(gse.id)} className="text-white/25 hover:text-white/70 p-1 rounded hover:bg-white/5"><Pencil className="h-3 w-3" /></button>
      <button onClick={() => onDelete(gse.id)} className="text-white/25 hover:text-red-400 p-1 rounded hover:bg-red-400/10"><Trash2 className="h-3 w-3" /></button>
    </div>
  )
}

// ─── Slot detail drawer ───────────────────────────────────────────────────────
// Shows: assignment (employee + clients) + exercises for the block (A/B/C),
// all three difficulties, inline-editable.
function SlotDrawer({
  slot, cycle, exercises: exerciseCatalog, employees, clients,
  sessionExercises, onUpdateGSE, onDeleteGSE, onAddGSE, onSwapGSE,
  onSaveAssignment, onClose,
}: {
  slot: Slot
  cycle: Cycle
  exercises: Exercise[]
  employees: Employee[]
  clients: Client[]
  sessionExercises: Record<string, GSE[]>
  onUpdateGSE: (gseId: string, data: Partial<Pick<GSE, 'sets' | 'reps' | 'weight_kg'>>) => void
  onDeleteGSE: (sessionId: string, gseId: string) => void
  onAddGSE:   (sessionId: string, ex: Exercise) => void
  onSwapGSE:  (gseId: string, sessionId: string) => void
  onSaveAssignment: (slotId: string, employeeId: string | null, clientIds: string[]) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<'exercises' | 'assignment'>('exercises')
  const [diffTab, setDiffTab] = useState<'regression' | 'base' | 'progression'>('base')
  const [pickerFor, setPickerFor] = useState<string | null>(null)   // sessionId
  const [swapFor,   setSwapFor]   = useState<{gseId: string; sessionId: string} | null>(null)

  // Assignment state
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(slot.assigned_employee_id)
  const [selectedClients,  setSelectedClients]  = useState<string[]>(slot.group_cycle_slot_clients.map(sc => sc.client_id))
  const [clientQuery,      setClientQuery]      = useState('')
  const [saving,           setSaving]           = useState(false)

  const filteredClients = clients.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(clientQuery.toLowerCase())
  )

  // Find the three sessions for this block
  const sessions = (['regression', 'base', 'progression'] as const).map(diff =>
    cycle.group_sessions.find(s => s.label === slot.block_label && s.difficulty === diff)
  )
  const activeSession = sessions[['regression','base','progression'].indexOf(diffTab)]

  async function handleSaveAssignment() {
    setSaving(true)
    await onSaveAssignment(slot.id, selectedEmployee, selectedClients)
    setSaving(false)
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Exercise picker overlay */}
      {(pickerFor || swapFor) && (
        <ExercisePicker
          exercises={exerciseCatalog}
          onSelect={ex => {
            if (swapFor) { onSwapGSE(swapFor.gseId, swapFor.sessionId); setSwapFor(null) }
            else if (pickerFor) { onAddGSE(pickerFor, ex); setPickerFor(null) }
          }}
          onClose={() => { setPickerFor(null); setSwapFor(null) }}
        />
      )}

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-[#141414] border-l border-white/10 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          <span className={`w-8 h-8 rounded-full ${BLOCK_COLORS[slot.block_label] ?? 'bg-white/20'} text-white text-sm font-bold flex items-center justify-center shrink-0`}>
            {slot.block_label}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold">{timeRange(slot.session_time)} · Bloc {slot.block_label}</p>
            <p className="text-white/30 text-xs">Dia {slot.day_index + 1} del cicle</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X className="h-5 w-5" /></button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-white/10 shrink-0">
          {([['exercises', 'Exercicis'], ['assignment', 'Assignació']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${tab === key ? 'text-[#FF914D] border-[#FF914D]' : 'text-white/40 border-transparent hover:text-white/70'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Exercises tab ── */}
        {tab === 'exercises' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Difficulty sub-tabs */}
            <div className="flex gap-1 p-3 border-b border-white/[0.06] shrink-0">
              {(['regression', 'base', 'progression'] as const).map(d => {
                const meta = DIFF_META[d]
                const sess = cycle.group_sessions.find(s => s.label === slot.block_label && s.difficulty === d)
                const count = sess ? (sessionExercises[sess.id] ?? sess.group_session_exercises).length : 0
                return (
                  <button key={d} onClick={() => setDiffTab(d)}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-medium transition-colors ${diffTab === d ? `${meta.bg} ${meta.color} border ${meta.border}` : 'text-white/30 hover:text-white/60'}`}>
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    {meta.label}
                    <span className="text-[10px] opacity-60">{count} exerc.</span>
                  </button>
                )
              })}
            </div>

            {/* Exercise list */}
            <div className="flex-1 overflow-y-auto p-4">
              {!activeSession ? (
                <p className="text-white/20 text-sm text-center py-8">Sense sessió per a aquest bloc</p>
              ) : (
                <>
                  {(sessionExercises[activeSession.id] ?? activeSession.group_session_exercises).length === 0 && (
                    <p className="text-white/20 text-sm italic mb-3">Sense exercicis</p>
                  )}
                  {(sessionExercises[activeSession.id] ?? activeSession.group_session_exercises)
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(gse => (
                      <ExerciseRow key={gse.id} gse={gse}
                        onUpdate={onUpdateGSE}
                        onDelete={id => onDeleteGSE(activeSession.id, id)}
                        onSwap={id => setSwapFor({ gseId: id, sessionId: activeSession.id })}
                      />
                    ))
                  }
                  <button
                    onClick={() => setPickerFor(activeSession.id)}
                    className={`mt-3 w-full flex items-center justify-center gap-1.5 text-xs ${DIFF_META[diffTab].color} py-2.5 rounded-xl border border-dashed ${DIFF_META[diffTab].border} hover:opacity-80 transition-opacity`}>
                    <Plus className="h-3.5 w-3.5" />
                    Afegir exercici
                  </button>
                </>
              )}
            </div>

            {/* Info footer */}
            <div className="px-4 py-3 border-t border-white/[0.06] shrink-0">
              <p className="text-[11px] text-white/25">
                Els exercicis s&apos;apliquen a totes les sessions del bloc {slot.block_label} del cicle.
              </p>
            </div>
          </div>
        )}

        {/* ── Assignment tab ── */}
        {tab === 'assignment' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
              {/* Employee */}
              <div>
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2 block">Entrenador</label>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setSelectedEmployee(null)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors ${!selectedEmployee ? 'bg-[#FF914D]/15 border border-[#FF914D]/30 text-white' : 'hover:bg-white/5 text-white/50'}`}>
                    <User className="h-4 w-4" />
                    Sense assignar
                    {!selectedEmployee && <Check className="h-3.5 w-3.5 ml-auto text-[#FF914D]" />}
                  </button>
                  {employees.map(emp => (
                    <button key={emp.id} onClick={() => setSelectedEmployee(emp.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${selectedEmployee === emp.id ? 'bg-[#FF914D]/15 border border-[#FF914D]/30 text-white' : 'hover:bg-white/5 text-white/60'}`}>
                      <User className="h-4 w-4 shrink-0" />
                      {emp.full_name}
                      {selectedEmployee === emp.id && <Check className="h-3.5 w-3.5 ml-auto text-[#FF914D]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-wide">
                    Clients ({selectedClients.length}/{slot.max_clients})
                  </label>
                  {selectedClients.length > 0 && (
                    <button onClick={() => setSelectedClients([])} className="text-xs text-white/30 hover:text-white/60">Treure tots</button>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                  <input value={clientQuery} onChange={e => setClientQuery(e.target.value)} placeholder="Cerca client..."
                    className="w-full bg-black/30 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF914D]/50" />
                </div>
                <div className="flex flex-col gap-0.5">
                  {filteredClients.map(c => {
                    const isSelected = selectedClients.includes(c.id)
                    const isFull     = selectedClients.length >= slot.max_clients && !isSelected
                    return (
                      <button key={c.id} disabled={isFull} onClick={() => setSelectedClients(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${isSelected ? 'bg-[#FF914D]/15 border border-[#FF914D]/30 text-white' : isFull ? 'opacity-30 cursor-not-allowed text-white/60' : 'hover:bg-white/5 text-white/60'}`}>
                        <Users className="h-3.5 w-3.5 shrink-0" />
                        {c.first_name} {c.last_name}
                        {isSelected && <Check className="h-3.5 w-3.5 ml-auto text-[#FF914D]" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Save bar */}
            <div className="px-4 py-3 border-t border-white/10 shrink-0">
              <button onClick={handleSaveAssignment} disabled={saving}
                className="w-full bg-[#FF914D] hover:bg-[#e07a3a] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
                {saving ? 'Guardant...' : 'Guardar assignació'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── Planning tab ─────────────────────────────────────────────────────────────
function PlanningTab({ cycle, exercises, employees, clients, holidays, sessionExercises, onUpdateGSE, onDeleteGSE, onAddGSE, onSwapGSE }: {
  cycle: Cycle
  exercises: Exercise[]
  employees: Employee[]
  clients: Client[]
  holidays: Holiday[]
  sessionExercises: Record<string, GSE[]>
  onUpdateGSE: (gseId: string, data: Partial<Pick<GSE, 'sets' | 'reps' | 'weight_kg'>>) => void
  onDeleteGSE: (sessionId: string, gseId: string) => void
  onAddGSE:   (sessionId: string, ex: Exercise) => void
  onSwapGSE:  (gseId: string, sessionId: string) => void
}) {
  const [slots, setSlots] = useState<Slot[]>(cycle.group_cycle_slots ?? [])
  const [openSlot, setOpenSlot] = useState<Slot | null>(null)
  const [localHolidays, setLocalHolidays] = useState<Holiday[]>(holidays)

  const employeeMap  = new Map(employees.map(e => [e.id, e.full_name]))
  const holidayMap   = new Map(localHolidays.filter(h => h.is_active).map(h => [h.date, h]))
  const holidayAllMap = new Map(localHolidays.map(h => [h.date, h]))

  // Build the working-day dates for this cycle, respecting start day and holidays
  const holidaySet = new Set(localHolidays.filter(h => h.is_active).map(h => h.date))
  const workingDayDates = generateCycleDates(cycle.start_date, 20, holidaySet)

  const slotsByDay = new Map<number, Slot[]>()
  for (const slot of slots) {
    if (!slotsByDay.has(slot.day_index)) slotsByDay.set(slot.day_index, [])
    slotsByDay.get(slot.day_index)!.push(slot)
  }

  async function handleSaveAssignment(slotId: string, employeeId: string | null, clientIds: string[]) {
    await updateSlotAssignmentAction(slotId, employeeId, clientIds)
    setSlots(prev => prev.map(s => s.id !== slotId ? s : {
      ...s,
      assigned_employee_id: employeeId,
      group_cycle_slot_clients: clientIds.map(cid => {
        const c = clients.find(cl => cl.id === cid)
        return { client_id: cid, clients: c ?? { id: cid, first_name: '?', last_name: '' } }
      }),
    }))
    setOpenSlot(prev => {
      if (!prev || prev.id !== slotId) return prev
      return {
        ...prev,
        assigned_employee_id: employeeId,
        group_cycle_slot_clients: clientIds.map(cid => {
          const c = clients.find(cl => cl.id === cid)
          return { client_id: cid, clients: c ?? { id: cid, first_name: '?', last_name: '' } }
        }),
      }
    })
  }

  async function handleToggleHoliday(date: string) {
    await toggleHolidayAction(date)
    setLocalHolidays(prev => {
      const existing = prev.find(h => h.date === date)
      if (existing) {
        return prev.map(h => h.date === date ? { ...h, is_active: !h.is_active, is_override: true } : h)
      }
      return [...prev, { date, name: 'Festivo añadido', scope: 'girona', is_active: true, is_override: true }]
    })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const weekLabels = ['Setmana 1', 'Setmana 2', 'Setmana 3', 'Setmana 4 (deload)']

  // Build full calendar grid: for each week, what dates occupy each column position
  // We need to show the actual calendar week (Mon-Fri) for each of the 4 cycle weeks.
  // Detect which calendar weeks are spanned by workingDayDates.
  // Group workingDayDates by ISO week, then display week by week.
  const weekGroups: Array<{ label: string; days: Array<{ date: string | null; dayIndex: number | null; holidayName: string | null; isSkipped: boolean }> }> = []

  if (workingDayDates.length === 20) {
    // For each of the 4 cycle weeks (groups of 5 working days), find the Mon–Fri span
    for (let w = 0; w < 4; w++) {
      const weekDates = workingDayDates.slice(w * 5, w * 5 + 5)
      // Find the Monday of the week containing the first working day
      const firstDate = new Date(weekDates[0] + 'T12:00:00')
      const dow0 = firstDate.getDay() === 0 ? 6 : firstDate.getDay() - 1  // 0=Mon
      const monday = new Date(firstDate)
      monday.setDate(monday.getDate() - dow0)

      const days = []
      for (let col = 0; col < 5; col++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + col)
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        const dayIdx = workingDayDates.indexOf(dateStr)
        const hol = holidayAllMap.get(dateStr)
        const isHolidayActive = holidayMap.has(dateStr)
        days.push({
          date: dateStr,
          dayIndex: dayIdx >= 0 ? dayIdx : null,
          holidayName: (hol && !isHolidayActive) ? hol.name : null,  // show name only when inactive (was override-disabled)
          activeHolidayName: isHolidayActive ? hol?.name ?? null : null,
          isSkipped: dayIdx < 0,  // it's a weekday in this calendar week but skipped (holiday or before cycle start)
        })
      }
      weekGroups.push({ label: weekLabels[w], days: days as any })
    }
  }

  return (
    <div>
      {openSlot && (
        <SlotDrawer
          slot={openSlot}
          cycle={cycle}
          exercises={exercises}
          employees={employees}
          clients={clients}
          sessionExercises={sessionExercises}
          onUpdateGSE={onUpdateGSE}
          onDeleteGSE={onDeleteGSE}
          onAddGSE={onAddGSE}
          onSwapGSE={onSwapGSE}
          onSaveAssignment={handleSaveAssignment}
          onClose={() => setOpenSlot(null)}
        />
      )}

      <div className="flex flex-col gap-6">
        {weekGroups.map(({ label, days }, week) => (
          <div key={week}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">{label}</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {(days as any[]).map((day: any, col: number) => {
                const isToday    = day.date === todayStr
                const isHoliday  = day.isSkipped && day.activeHolidayName  // active holiday → grayed
                const isOverride = day.isSkipped && !day.activeHolidayName && !day.holidayName  // skipped for other reason (before start)
                const dayDate    = new Date(day.date + 'T12:00:00')
                const dayLabel   = DAY_SHORT[col]
                const dayNum     = dayDate.getDate()
                const daySlots   = day.dayIndex != null
                  ? (slotsByDay.get(day.dayIndex) ?? []).sort((a: any, b: any) =>
                      a.session_time.localeCompare(b.session_time) || a.block_label.localeCompare(b.block_label))
                  : []

                // Holiday cell (active — grayed out, no slots)
                if (isHoliday) {
                  return (
                    <div key={col} className="rounded-xl border border-white/[0.04] bg-white/[0.01] overflow-hidden opacity-50" title={day.activeHolidayName}>
                      <div className="px-2 py-1.5 border-b border-white/[0.06]">
                        <p className="text-[11px] font-semibold text-white/30">{dayLabel} {dayNum}</p>
                        <p className="text-[9px] text-white/20 truncate">{DAY_NAMES[col]}</p>
                      </div>
                      <div className="p-1.5 flex flex-col items-center gap-1">
                        <p className="text-[9px] text-white/25 text-center leading-tight">{day.activeHolidayName}</p>
                        <button
                          onClick={() => handleToggleHoliday(day.date)}
                          title="Anular festivo para este ciclo"
                          className="text-[9px] text-[#FF914D]/60 hover:text-[#FF914D] underline transition-colors mt-0.5">
                          Revertir
                        </button>
                      </div>
                    </div>
                  )
                }

                // Skipped cell (before cycle start, or non-working for other reason)
                if (day.isSkipped) {
                  return (
                    <div key={col} className="rounded-xl border border-white/[0.03] bg-transparent overflow-hidden">
                      <div className="px-2 py-1.5">
                        <p className="text-[11px] font-semibold text-white/15">{dayLabel} {dayNum}</p>
                      </div>
                    </div>
                  )
                }

                // Normal working day
                return (
                  <div key={col}
                    className={`rounded-xl border ${isToday ? 'border-[#FF914D]/40 bg-[#FF914D]/5' : 'border-white/[0.08] bg-white/[0.02]'} overflow-hidden`}>
                    <div className={`px-2 py-1.5 border-b ${isToday ? 'border-[#FF914D]/20 bg-[#FF914D]/10' : 'border-white/[0.08]'}`}>
                      <p className={`text-[11px] font-semibold ${isToday ? 'text-[#FF914D]' : 'text-white/50'}`}>
                        {dayLabel} {dayNum}
                      </p>
                      <p className="text-[9px] text-white/25">{DAY_NAMES[col]}</p>
                    </div>
                    <div className="p-1.5 flex flex-col gap-1.5">
                      {daySlots.length === 0 && <p className="text-[10px] text-white/20 text-center py-2">—</p>}
                      {daySlots.map((slot: any) => {
                        const clientCount = slot.group_cycle_slot_clients.length
                        const empName = slot.assigned_employee_id
                          ? employeeMap.get(slot.assigned_employee_id)?.split(' ')[0] ?? '?'
                          : null
                        const baseSession = cycle.group_sessions.find((s: any) => s.label === slot.block_label && s.difficulty === 'base')
                        const exCount = baseSession ? (sessionExercises[baseSession.id] ?? baseSession.group_session_exercises).length : 0

                        return (
                          <button key={slot.id}
                            onClick={() => setOpenSlot(slot)}
                            className="w-full text-left rounded-lg bg-black/20 hover:bg-black/50 border border-white/[0.06] hover:border-white/20 transition-all p-1.5 group">
                            <div className="flex items-center gap-1 mb-1">
                              <span className={`w-4 h-4 rounded-full ${BLOCK_COLORS[slot.block_label] ?? 'bg-white/20'} text-white text-[9px] font-bold flex items-center justify-center shrink-0`}>
                                {slot.block_label}
                              </span>
                              <span className="text-[10px] text-white/70 font-medium flex-1">{timeRange(slot.session_time)}</span>
                              <ChevronRight className="h-3 w-3 text-white/15 group-hover:text-white/40 shrink-0" />
                            </div>
                            <div className="flex items-center gap-1 mb-0.5">
                              <User className="h-2.5 w-2.5 text-white/25 shrink-0" />
                              <span className={`text-[9px] truncate ${empName ? 'text-white/50' : 'text-white/20'}`}>{empName ?? '—'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <Users className="h-2.5 w-2.5 text-white/25 shrink-0" />
                                <span className={`text-[9px] ${clientCount > 0 ? 'text-white/50' : 'text-white/20'}`}>{clientCount}/{slot.max_clients}</span>
                              </div>
                              {exCount > 0 && (
                                <div className="flex items-center gap-1">
                                  <Dumbbell className="h-2.5 w-2.5 text-white/25 shrink-0" />
                                  <span className="text-[9px] text-white/30">{exCount}</span>
                                </div>
                              )}
                            </div>
                          </button>
                        )
                      })}
                    </div>
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

// ─── Main component ───────────────────────────────────────────────────────────
type SessionState = Record<string, GSE[]>

export default function CycleEditor({ cycle, exercises, employees, clients, holidays }: Props) {
  const [, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<'exercises' | 'planning'>('exercises')

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

  const handleUpdate = (gseId: string, data: Partial<Pick<GSE, 'sets' | 'reps' | 'weight_kg'>>) => {
    startTransition(async () => { await updateGroupSessionExerciseAction(gseId, data) })
  }

  const handleDelete = (sessionId: string, gseId: string) => {
    startTransition(async () => {
      setSessionExercises(prev => ({ ...prev, [sessionId]: (prev[sessionId] ?? []).filter(e => e.id !== gseId) }))
      await deleteGroupSessionExerciseAction(gseId)
    })
  }

  const handleAdd = (sessionId: string, ex: Exercise) => {
    startTransition(async () => {
      const current    = sessionExercises[sessionId] ?? []
      const order_index = current.length
      const tempId     = `temp-${Date.now()}`
      const tempGSE: GSE = { id: tempId, exercise_id: ex.id, sets: 3, reps: 10, weight_kg: null, notes: null, order_index, exercises: ex }
      setSessionExercises(prev => ({ ...prev, [sessionId]: [...(prev[sessionId] ?? []), tempGSE] }))
      const result = await addGroupSessionExerciseAction(sessionId, ex.id, { sets: 3, reps: 10, order_index })
      if (result.row) {
        setSessionExercises(prev => ({
          ...prev,
          [sessionId]: (prev[sessionId] ?? []).map(e => e.id === tempId ? (result.row as unknown as GSE) : e),
        }))
      }
    })
  }

  const handleSwap = (gseId: string, sessionId: string) => {
    setPickerOpen({ sessionId, swapGseId: gseId })
  }

  const handleSwapPick = (ex: Exercise) => {
    if (!pickerOpen?.swapGseId) return
    const { swapGseId, sessionId } = pickerOpen
    startTransition(async () => {
      setSessionExercises(prev => ({
        ...prev,
        [sessionId]: (prev[sessionId] ?? []).map(e => e.id === swapGseId ? { ...e, exercise_id: ex.id, exercises: ex } : e),
      }))
      await swapGroupSessionExerciseAction(swapGseId, ex.id)
    })
  }

  return (
    <div className="min-h-screen bg-[#111111] p-6">
      {/* Global exercise picker (for the Exercises tab grid) */}
      {pickerOpen && (
        <ExercisePicker
          exercises={exercises}
          onSelect={ex => {
            if (pickerOpen.swapGseId) handleSwapPick(ex)
            else handleAdd(pickerOpen.sessionId, ex)
          }}
          onClose={() => setPickerOpen(null)}
        />
      )}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/sesiones" className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Tornar
            </Link>
            <span className="text-white/20">/</span>
            <span className="text-white font-semibold">{formatDateRange(cycle.start_date)}</span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
          </div>
          {cycle.notes && <p className="text-white/40 text-sm">{cycle.notes}</p>}
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 mb-6 w-fit">
          <button onClick={() => setActiveTab('exercises')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'exercises' ? 'bg-[#1C1C1C] text-white shadow' : 'text-white/40 hover:text-white/70'}`}>
            <Dumbbell className="h-4 w-4" />
            Exercicis
          </button>
          <button onClick={() => setActiveTab('planning')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'planning' ? 'bg-[#1C1C1C] text-white shadow' : 'text-white/40 hover:text-white/70'}`}>
            <Calendar className="h-4 w-4" />
            Planificació
          </button>
        </div>

        {/* ── Exercises tab ── */}
        {activeTab === 'exercises' && (
          <>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div />
              {(['regression', 'base', 'progression'] as const).map(diff => (
                <div key={diff} className="text-center">
                  <span className={`text-sm font-semibold ${DIFF_META[diff].color}`}>{DIFF_META[diff].label}</span>
                </div>
              ))}
            </div>
            {(['A', 'B', 'C'] as const).map(label => (
              <div key={label} className="grid grid-cols-4 gap-3 mb-3">
                <div className="flex items-start pt-3 justify-center">
                  <span className="w-8 h-8 rounded-full bg-[#FF914D] text-white text-sm font-bold flex items-center justify-center">{label}</span>
                </div>
                {(['regression', 'base', 'progression'] as const).map(diff => {
                  const session = getSession(label, diff)
                  const meta    = DIFF_META[diff]
                  const gses    = session ? (sessionExercises[session.id] ?? []) : []
                  return (
                    <div key={diff} className={`rounded-xl border ${meta.border} ${meta.bg} p-3`}>
                      {!session ? (
                        <p className="text-white/20 text-xs italic">Sense sessió</p>
                      ) : (
                        <>
                          {gses.map(gse => (
                            <ExerciseRow key={gse.id} gse={gse}
                              onUpdate={handleUpdate}
                              onDelete={id => handleDelete(session.id, id)}
                              onSwap={id => setPickerOpen({ sessionId: session.id, swapGseId: id })}
                            />
                          ))}
                          {gses.length === 0 && <p className="text-white/20 text-xs italic mb-2">Sense exercicis</p>}
                          <button onClick={() => setPickerOpen({ sessionId: session.id })}
                            className={`mt-2 w-full flex items-center justify-center gap-1 text-xs ${meta.color} hover:opacity-80 py-1.5 rounded-lg border border-dashed ${meta.border}`}>
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
          </>
        )}

        {/* ── Planning tab ── */}
        {activeTab === 'planning' && (
          <PlanningTab
            cycle={cycle}
            exercises={exercises}
            employees={employees}
            clients={clients}
            holidays={holidays}
            sessionExercises={sessionExercises}
            onUpdateGSE={handleUpdate}
            onDeleteGSE={handleDelete}
            onAddGSE={handleAdd}
            onSwapGSE={handleSwap}
          />
        )}
      </div>
    </div>
  )
}
