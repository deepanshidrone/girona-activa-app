'use client'

import { useState, useTransition, useOptimistic, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2, Plus, Search, X, User, Users, Check, Calendar, Dumbbell } from 'lucide-react'
import {
  updateGroupSessionExerciseAction,
  addGroupSessionExerciseAction,
  deleteGroupSessionExerciseAction,
  swapGroupSessionExerciseAction,
  updateSlotAssignmentAction,
} from '@/app/actions/group-sessions'

type Exercise = { id: string; name: string; technical_name?: string | null }
type Employee = { id: string; full_name: string }
type Client = { id: string; first_name: string; last_name: string }

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

type Props = {
  cycle: Cycle
  exercises: Exercise[]
  employees: Employee[]
  clients: Client[]
}

const DIFF_META = {
  regression:  { label: 'Regressió',  color: 'text-blue-400',   border: 'border-blue-400/20',   bg: 'bg-blue-400/5'   },
  base:        { label: 'Base',       color: 'text-[#FF914D]',  border: 'border-[#FF914D]/20',  bg: 'bg-[#FF914D]/5'  },
  progression: { label: 'Progressió', color: 'text-purple-400', border: 'border-purple-400/20', bg: 'bg-purple-400/5' },
} as const

const BLOCK_COLORS: Record<string, string> = {
  A: 'bg-[#FF914D]',
  B: 'bg-blue-500',
  C: 'bg-purple-500',
}

const DAY_NAMES = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres']
const DAY_SHORT = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv']

function formatDateRange(startDate: string) {
  const start = new Date(startDate)
  const end = new Date(startDate)
  end.setDate(end.getDate() + 27)
  const fmt = (d: Date) => d.toLocaleDateString('ca-ES', { day: 'numeric', month: 'short' })
  return `${fmt(start)} — ${fmt(end)}`
}

function getCycleStatus(startDate: string): { label: string; color: string } {
  const start = new Date(startDate)
  const end = new Date(startDate)
  end.setDate(end.getDate() + 28)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (today < start) return { label: 'Pròxim', color: 'text-blue-400 bg-blue-400/10' }
  if (today >= start && today < end) return { label: 'Actiu', color: 'text-green-400 bg-green-400/10' }
  return { label: 'Expirat', color: 'text-white/30 bg-white/5' }
}

function getDayDate(startDate: string, day_index: number): Date {
  const d = new Date(startDate + 'T12:00:00')
  const week = Math.floor(day_index / 5)
  const dayOfWeek = day_index % 5
  d.setDate(d.getDate() + week * 7 + dayOfWeek)
  return d
}

// ── Exercise picker modal ──────────────────────────────────────────────────────
function ExercisePicker({ exercises, onSelect, onClose }: { exercises: Exercise[]; onSelect: (ex: Exercise) => void; onClose: () => void }) {
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
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Cerca exercici..."
            className="w-full bg-black/30 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF914D]/50" />
        </div>
        <div className="max-h-72 overflow-y-auto flex flex-col gap-1">
          {filtered.length === 0 && <p className="text-white/30 text-sm text-center py-4">Sense resultats</p>}
          {filtered.map(ex => (
            <button key={ex.id} onClick={() => { onSelect(ex); onClose() }}
              className="flex flex-col items-start px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-left">
              <span className="text-white text-sm">{ex.name}</span>
              {ex.technical_name && <span className="text-white/30 text-xs">{ex.technical_name}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Slot assignment modal ──────────────────────────────────────────────────────
function SlotModal({
  slot, employees, clients, onClose, onSave,
}: {
  slot: Slot
  employees: Employee[]
  clients: Client[]
  onClose: () => void
  onSave: (slotId: string, employeeId: string | null, clientIds: string[]) => void
}) {
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(slot.assigned_employee_id)
  const [selectedClients, setSelectedClients] = useState<string[]>(
    slot.group_cycle_slot_clients.map(sc => sc.client_id)
  )
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')

  const filteredClients = clients.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(query.toLowerCase())
  )

  function toggleClient(id: string) {
    setSelectedClients(prev =>
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    setSaving(true)
    await onSave(slot.id, selectedEmployee, selectedClients)
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full ${BLOCK_COLORS[slot.block_label] ?? 'bg-white/20'} text-white text-xs font-bold flex items-center justify-center`}>
              {slot.block_label}
            </span>
            <span className="text-white font-semibold">{slot.session_time}</span>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-5">
          {/* Employee selector */}
          <div>
            <label className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2 block">Entrenador</label>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setSelectedEmployee(null)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${!selectedEmployee ? 'bg-[#FF914D]/15 border border-[#FF914D]/30 text-white' : 'hover:bg-white/5 text-white/50'}`}
              >
                <User className="h-4 w-4" />
                Sense assignar
              </button>
              {employees.map(emp => (
                <button key={emp.id}
                  onClick={() => setSelectedEmployee(emp.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-left ${selectedEmployee === emp.id ? 'bg-[#FF914D]/15 border border-[#FF914D]/30 text-white' : 'hover:bg-white/5 text-white/60'}`}
                >
                  <User className="h-4 w-4 shrink-0" />
                  {emp.full_name}
                  {selectedEmployee === emp.id && <Check className="h-3.5 w-3.5 ml-auto text-[#FF914D]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Client multi-select */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-white/50 font-medium uppercase tracking-wide">Clients ({selectedClients.length}/{slot.max_clients})</label>
              {selectedClients.length > 0 && (
                <button onClick={() => setSelectedClients([])} className="text-xs text-white/30 hover:text-white/60 transition-colors">Treure tots</button>
              )}
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cerca client..."
                className="w-full bg-black/30 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#FF914D]/50" />
            </div>
            <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5">
              {filteredClients.map(c => {
                const isSelected = selectedClients.includes(c.id)
                const isFull = selectedClients.length >= slot.max_clients && !isSelected
                return (
                  <button key={c.id}
                    disabled={isFull}
                    onClick={() => toggleClient(c.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-left ${isSelected ? 'bg-[#FF914D]/15 border border-[#FF914D]/30 text-white' : isFull ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/5 text-white/60'}`}
                  >
                    <Users className="h-3.5 w-3.5 shrink-0" />
                    {c.first_name} {c.last_name}
                    {isSelected && <Check className="h-3.5 w-3.5 ml-auto text-[#FF914D]" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-[#FF914D] hover:bg-[#e07a3a] disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-xl transition-colors">
            {saving ? 'Guardant...' : 'Guardar'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm text-white/50 hover:text-white transition-colors">Cancel·lar</button>
        </div>
      </div>
    </div>
  )
}

// ── Exercise row ───────────────────────────────────────────────────────────────
function ExerciseRow({ gse, onUpdate, onDelete, onSwap }: {
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
        {gse.exercises?.technical_name && <p className="text-white/30 text-[10px] truncate">{gse.exercises.technical_name}</p>}
      </div>
      <input className={inputCls} value={sets} onChange={e => setSets(e.target.value)}
        onBlur={() => { const v = parseInt(sets); if (!isNaN(v) && v > 0) onUpdate(gse.id, { sets: v }) }} title="Sèries" />
      <span className="text-white/20 text-xs">×</span>
      <input className={inputCls} value={reps} onChange={e => setReps(e.target.value)}
        onBlur={() => { const v = parseInt(reps); if (!isNaN(v) && v > 0) onUpdate(gse.id, { reps: v }) }} title="Reps" />
      <input className="w-14 bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-[#FF914D]/50"
        value={weight} onChange={e => setWeight(e.target.value)}
        onBlur={() => { const v = weight === '' ? null : parseFloat(weight); onUpdate(gse.id, { weight_kg: v }) }}
        placeholder="kg" title="Càrrega" />
      <button onClick={() => onSwap(gse.id)} className="text-white/30 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/5"><Pencil className="h-3 w-3" /></button>
      <button onClick={() => onDelete(gse.id)} className="text-white/30 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-400/10"><Trash2 className="h-3 w-3" /></button>
    </div>
  )
}

// ── Planning tab ───────────────────────────────────────────────────────────────
function PlanningTab({ cycle, employees, clients }: { cycle: Cycle; employees: Employee[]; clients: Client[] }) {
  const [slots, setSlots] = useState<Slot[]>(cycle.group_cycle_slots ?? [])
  const [editingSlot, setEditingSlot] = useState<Slot | null>(null)

  const employeeMap = new Map(employees.map(e => [e.id, e.full_name]))

  const slotsByDay = new Map<number, Slot[]>()
  for (const slot of slots) {
    if (!slotsByDay.has(slot.day_index)) slotsByDay.set(slot.day_index, [])
    slotsByDay.get(slot.day_index)!.push(slot)
  }

  async function handleSave(slotId: string, employeeId: string | null, clientIds: string[]) {
    await updateSlotAssignmentAction(slotId, employeeId, clientIds)
    setSlots(prev => prev.map(s => s.id !== slotId ? s : {
      ...s,
      assigned_employee_id: employeeId,
      group_cycle_slot_clients: clientIds.map(cid => {
        const c = clients.find(cl => cl.id === cid)
        return { client_id: cid, clients: c ?? { id: cid, first_name: '?', last_name: '' } }
      }),
    }))
  }

  const weeks = [0, 1, 2, 3]
  const weekLabels = ['Setmana 1', 'Setmana 2', 'Setmana 3', 'Setmana 4 (deload)']
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div>
      {editingSlot && (
        <SlotModal
          slot={editingSlot}
          employees={employees}
          clients={clients}
          onClose={() => setEditingSlot(null)}
          onSave={handleSave}
        />
      )}

      <div className="flex flex-col gap-6">
        {weeks.map(week => (
          <div key={week}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wide">{weekLabels[week]}</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[0, 1, 2, 3, 4].map(dow => {
                const dayIdx = week * 5 + dow
                const dayDate = getDayDate(cycle.start_date, dayIdx)
                const isToday = dayDate.toDateString() === today.toDateString()
                const daySlots = (slotsByDay.get(dayIdx) ?? []).sort((a, b) =>
                  a.session_time.localeCompare(b.session_time) || a.block_label.localeCompare(b.block_label)
                )

                return (
                  <div key={dow}
                    className={`rounded-xl border ${isToday ? 'border-[#FF914D]/40 bg-[#FF914D]/5' : 'border-white/8 bg-white/[0.02]'} overflow-hidden`}>
                    {/* Day header */}
                    <div className={`px-2 py-1.5 border-b ${isToday ? 'border-[#FF914D]/20 bg-[#FF914D]/10' : 'border-white/8'}`}>
                      <p className={`text-[11px] font-semibold ${isToday ? 'text-[#FF914D]' : 'text-white/50'}`}>
                        {DAY_SHORT[dow]} {dayDate.getDate()}
                      </p>
                      <p className="text-[9px] text-white/25">{DAY_NAMES[dow].substring(0, 3)}</p>
                    </div>

                    {/* Slots */}
                    <div className="p-1.5 flex flex-col gap-1.5">
                      {daySlots.length === 0 && (
                        <p className="text-[10px] text-white/20 text-center py-2">—</p>
                      )}
                      {daySlots.map(slot => {
                        const clientCount = slot.group_cycle_slot_clients.length
                        const empName = slot.assigned_employee_id
                          ? employeeMap.get(slot.assigned_employee_id)?.split(' ')[0] ?? '?'
                          : null

                        return (
                          <button key={slot.id}
                            onClick={() => setEditingSlot(slot)}
                            className="w-full text-left rounded-lg bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/15 transition-colors p-1.5">
                            <div className="flex items-center gap-1 mb-1">
                              <span className={`w-4 h-4 rounded-full ${BLOCK_COLORS[slot.block_label] ?? 'bg-white/20'} text-white text-[9px] font-bold flex items-center justify-center shrink-0`}>
                                {slot.block_label}
                              </span>
                              <span className="text-[10px] text-white/70 font-medium">{slot.session_time}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-2.5 w-2.5 text-white/25 shrink-0" />
                              <span className={`text-[9px] truncate ${empName ? 'text-white/50' : 'text-white/20'}`}>
                                {empName ?? '—'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Users className="h-2.5 w-2.5 text-white/25 shrink-0" />
                              <span className={`text-[9px] ${clientCount > 0 ? 'text-white/50' : 'text-white/20'}`}>
                                {clientCount}/{slot.max_clients}
                              </span>
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

// ── Main component ─────────────────────────────────────────────────────────────
type SessionState = { [sessionId: string]: GSE[] }

export default function CycleEditor({ cycle, exercises, employees, clients }: Props) {
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

  const handleUpdate = (gseId: string, data: Partial<Pick<GSE, 'sets' | 'reps' | 'weight_kg' | 'notes'>>) => {
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
      const current = sessionExercises[sessionId] ?? []
      const order_index = current.length
      const tempId = `temp-${Date.now()}`
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

  const handleSwapPick = (gseId: string, ex: Exercise, sessionId: string) => {
    startTransition(async () => {
      setSessionExercises(prev => ({
        ...prev,
        [sessionId]: (prev[sessionId] ?? []).map(e => e.id === gseId ? { ...e, exercise_id: ex.id, exercises: ex } : e),
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
            if (pickerOpen.swapGseId) handleSwapPick(pickerOpen.swapGseId, ex, pickerOpen.sessionId)
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

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 mb-6 w-fit">
          <button
            onClick={() => setActiveTab('exercises')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'exercises' ? 'bg-[#1C1C1C] text-white shadow' : 'text-white/40 hover:text-white/70'}`}
          >
            <Dumbbell className="h-4 w-4" />
            Exercicis
          </button>
          <button
            onClick={() => setActiveTab('planning')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'planning' ? 'bg-[#1C1C1C] text-white shadow' : 'text-white/40 hover:text-white/70'}`}
          >
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
                          {gses.length === 0 && <p className="text-white/20 text-xs italic mb-2">Sense exercicis</p>}
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
          </>
        )}

        {/* ── Planning tab ── */}
        {activeTab === 'planning' && (
          <PlanningTab cycle={cycle} employees={employees} clients={clients} />
        )}
      </div>
    </div>
  )
}
