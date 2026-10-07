'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Copy, Trash2, ChevronRight, X, Check, Star, Clock, AlertCircle,
} from 'lucide-react'
import {
  createTemplateAction, updateTemplateAction, deleteTemplateAction, duplicateTemplateAction,
  type TemplateDayData, type TemplateSlotData,
} from '@/app/actions/cycle-templates'

// ─── Types ────────────────────────────────────────────────────────────────────
type Template = {
  id: string
  name: string
  notes: string | null
  is_default: boolean
  cycle_template_days: TemplateDayData[]
  cycle_template_slots: (TemplateSlotData & { id: string })[]
}

const DAY_NAMES   = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres']
const DAY_SHORT   = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv']
const BLOCK_COLORS: Record<string, string> = { A: 'bg-[#FF914D]', B: 'bg-blue-500', C: 'bg-purple-500' }
const BLOCK_TEXT:  Record<string, string> = { A: 'text-[#FF914D]', B: 'text-blue-400', C: 'text-purple-400' }
const WEEK_LABELS  = ['S1', 'S2', 'S3', 'S4↓']

// Default 4-week pattern
const DEFAULT_PATTERN: TemplateDayData[] = [
  ...['A','A','B','B','C'].map((b,i) => ({ day_index: i,    block_label: b as 'A'|'B'|'C' })),
  ...['B','B','C','C','A'].map((b,i) => ({ day_index: i+5,  block_label: b as 'A'|'B'|'C' })),
  ...['C','C','A','A','B'].map((b,i) => ({ day_index: i+10, block_label: b as 'A'|'B'|'C' })),
  ...['A','A','B','B','C'].map((b,i) => ({ day_index: i+15, block_label: b as 'A'|'B'|'C' })),
]

const DEFAULT_SLOTS: TemplateSlotData[] = [
  ...[0,1,2,3].flatMap(dow => [
    { day_of_week: dow, session_time: '07:00', has_overlap: true,  max_clients: 6 },
    { day_of_week: dow, session_time: '09:30', has_overlap: false, max_clients: 6 },
    { day_of_week: dow, session_time: '11:00', has_overlap: false, max_clients: 6 },
    { day_of_week: dow, session_time: '15:30', has_overlap: false, max_clients: 6 },
    { day_of_week: dow, session_time: '17:00', has_overlap: false, max_clients: 6 },
    { day_of_week: dow, session_time: '19:00', has_overlap: false, max_clients: 6 },
    { day_of_week: dow, session_time: '20:00', has_overlap: false, max_clients: 6 },
  ]),
  { day_of_week: 4, session_time: '07:00', has_overlap: false, max_clients: 6 },
  { day_of_week: 4, session_time: '09:30', has_overlap: false, max_clients: 6 },
  { day_of_week: 4, session_time: '11:00', has_overlap: false, max_clients: 6 },
  { day_of_week: 4, session_time: '15:30', has_overlap: false, max_clients: 6 },
  { day_of_week: 4, session_time: '17:00', has_overlap: false, max_clients: 6 },
]

// ─── Template card ─────────────────────────────────────────────────────────────
function TemplateCard({ template, onEdit, onDuplicate, onDelete }: {
  template: Template
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const days = [...template.cycle_template_days].sort((a,b) => a.day_index - b.day_index)
  const slotCount = template.cycle_template_slots.length

  return (
    <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          {template.is_default && <Star className="h-3.5 w-3.5 text-[#FF914D] fill-[#FF914D]" />}
          <span className="text-white font-semibold">{template.name}</span>
          {template.is_default && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FF914D]/15 text-[#FF914D]">Por defecto</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onDuplicate} title="Duplicar" className="p-2 text-white/30 hover:text-white/70 hover:bg-white/5 rounded-lg transition-colors">
            <Copy className="h-3.5 w-3.5" />
          </button>
          {!template.is_default && (
            <button onClick={onDelete} title="Eliminar" className="p-2 text-white/30 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onEdit} className="flex items-center gap-1.5 text-xs text-[#FF914D] hover:underline ml-1">
            Editar <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Pattern preview */}
      <div className="px-5 pt-4 pb-2">
        <p className="text-[10px] text-white/30 uppercase tracking-wide font-medium mb-2">Patrón mensual</p>
        <div className="flex flex-col gap-1.5">
          {[0,1,2,3].map(week => (
            <div key={week} className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/25 w-6 shrink-0">{WEEK_LABELS[week]}</span>
              <div className="flex gap-1 flex-1">
                {[0,1,2,3,4].map(dow => {
                  const day = days.find(d => d.day_index === week*5+dow)
                  return (
                    <div key={dow} className="flex-1 flex items-center justify-center">
                      {day ? (
                        <span className={`w-6 h-6 rounded-full ${BLOCK_COLORS[day.block_label]} text-white text-[10px] font-bold flex items-center justify-center`}>
                          {day.block_label}
                        </span>
                      ) : <span className="text-white/15 text-[10px]">—</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Slots summary */}
      <div className="px-5 py-3 flex items-center gap-2 border-t border-white/[0.06] mt-2">
        <Clock className="h-3.5 w-3.5 text-white/25" />
        <span className="text-xs text-white/40">{slotCount} franjas intradía</span>
        {template.notes && <span className="text-xs text-white/25 ml-1">· {template.notes}</span>}
      </div>
    </div>
  )
}

// ─── Pattern editor (20-cell grid) ────────────────────────────────────────────
function PatternEditor({ days, onChange }: {
  days: TemplateDayData[]
  onChange: (days: TemplateDayData[]) => void
}) {
  function cycleBlock(dayIndex: number) {
    const current = days.find(d => d.day_index === dayIndex)?.block_label ?? 'A'
    const next: Record<string, 'A'|'B'|'C'> = { A: 'B', B: 'C', C: 'A' }
    onChange(days.map(d => d.day_index === dayIndex ? { ...d, block_label: next[current] } : d))
  }

  return (
    <div>
      <p className="text-xs text-white/40 mb-3">Clic en un día para cambiar el bloque (A → B → C → A)</p>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-8" />
          {DAY_SHORT.map(d => (
            <span key={d} className="flex-1 text-center text-[11px] text-white/30 font-medium">{d}</span>
          ))}
        </div>
        {[0,1,2,3].map(week => (
          <div key={week} className="flex items-center gap-2">
            <span className="text-[11px] text-white/30 w-8 text-right">{WEEK_LABELS[week]}</span>
            {[0,1,2,3,4].map(dow => {
              const dayIdx = week*5+dow
              const block = days.find(d => d.day_index === dayIdx)?.block_label ?? 'A'
              return (
                <button key={dow} onClick={() => cycleBlock(dayIdx)}
                  className={`flex-1 h-9 rounded-xl ${BLOCK_COLORS[block]} text-white text-sm font-bold hover:opacity-80 transition-opacity`}>
                  {block}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Slots editor ──────────────────────────────────────────────────────────────
function SlotsEditor({ slots, onChange }: {
  slots: TemplateSlotData[]
  onChange: (slots: TemplateSlotData[]) => void
}) {
  const [newTime,   setNewTime]   = useState('')
  const [newDow,    setNewDow]    = useState(0)
  const [newMax,    setNewMax]    = useState(6)
  const [newOverlap, setNewOverlap] = useState(false)

  function addSlot() {
    if (!newTime) return
    const exists = slots.some(s => s.day_of_week === newDow && s.session_time === newTime + ':00')
    if (exists) return
    onChange([...slots, { day_of_week: newDow, session_time: newTime + ':00', has_overlap: newOverlap, max_clients: newMax }])
    setNewTime('')
  }

  function removeSlot(dow: number, time: string) {
    onChange(slots.filter(s => !(s.day_of_week === dow && s.session_time === time)))
  }

  function toggleOverlap(dow: number, time: string) {
    onChange(slots.map(s => s.day_of_week === dow && s.session_time === time ? { ...s, has_overlap: !s.has_overlap } : s))
  }

  function updateMax(dow: number, time: string, max: number) {
    onChange(slots.map(s => s.day_of_week === dow && s.session_time === time ? { ...s, max_clients: max } : s))
  }

  return (
    <div>
      <p className="text-xs text-white/40 mb-3">
        <span className="text-[#FF914D] font-medium">Solapamiento</span>: a esa hora habrá 2 sesiones simultáneas (bloque principal + siguiente bloque)
      </p>
      <div className="flex flex-col gap-4">
        {[0,1,2,3,4].map(dow => {
          const daySlots = slots.filter(s => s.day_of_week === dow).sort((a,b) => a.session_time.localeCompare(b.session_time))
          return (
            <div key={dow}>
              <p className="text-xs font-semibold text-white/50 mb-1.5">{DAY_NAMES[dow]}</p>
              <div className="flex flex-wrap gap-2">
                {daySlots.map(s => (
                  <div key={s.session_time}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${s.has_overlap ? 'border-[#FF914D]/30 bg-[#FF914D]/10' : 'border-white/10 bg-white/5'}`}>
                    <span className="text-white font-medium">{s.session_time.slice(0,5)}</span>
                    {/* Overlap toggle */}
                    <button onClick={() => toggleOverlap(dow, s.session_time)}
                      title="Solapamiento" className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${s.has_overlap ? 'border-[#FF914D] bg-[#FF914D]' : 'border-white/30'}`}>
                      {s.has_overlap && <Check className="h-2.5 w-2.5 text-white" />}
                    </button>
                    {/* Max clients */}
                    <input type="number" min={1} max={20} value={s.max_clients}
                      onChange={e => updateMax(dow, s.session_time, parseInt(e.target.value) || 6)}
                      className="w-8 bg-transparent text-center text-white/60 focus:outline-none focus:text-white" title="Máx clientes" />
                    <button onClick={() => removeSlot(dow, s.session_time)} className="text-white/20 hover:text-red-400 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {daySlots.length === 0 && <span className="text-white/20 text-xs italic">Sin franjas</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add slot form */}
      <div className="mt-4 flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl p-3">
        <select value={newDow} onChange={e => setNewDow(parseInt(e.target.value))}
          className="bg-transparent text-white text-xs border border-white/10 rounded-lg px-2 py-1.5 focus:outline-none">
          {DAY_NAMES.map((d,i) => <option key={i} value={i} className="bg-[#1C1C1C]">{d}</option>)}
        </select>
        <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
          className="bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white [color-scheme:dark] focus:outline-none focus:border-[#FF914D]/50" />
        <input type="number" min={1} max={20} value={newMax} onChange={e => setNewMax(parseInt(e.target.value)||6)}
          placeholder="Máx" className="w-14 bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none" />
        <label className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer">
          <input type="checkbox" checked={newOverlap} onChange={e => setNewOverlap(e.target.checked)} className="accent-[#FF914D]" />
          Solapam.
        </label>
        <button onClick={addSlot} disabled={!newTime}
          className="flex items-center gap-1 bg-[#FF914D] hover:bg-[#e07a3a] disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
          <Plus className="h-3 w-3" /> Añadir
        </button>
      </div>
    </div>
  )
}

// ─── Template editor drawer ────────────────────────────────────────────────────
function TemplateEditor({ template, onClose, onSaved }: {
  template: Template | null  // null = nueva plantilla
  onClose: () => void
  onSaved: () => void
}) {
  const isNew = !template
  const [name,    setName]    = useState(template?.name ?? '')
  const [notes,   setNotes]   = useState(template?.notes ?? '')
  const [days,    setDays]    = useState<TemplateDayData[]>(
    template?.cycle_template_days.map(d => ({ day_index: d.day_index, block_label: d.block_label })) ?? DEFAULT_PATTERN
  )
  const [slots,   setSlots]   = useState<TemplateSlotData[]>(
    template?.cycle_template_slots.map(s => ({ day_of_week: s.day_of_week, session_time: s.session_time, has_overlap: s.has_overlap, max_clients: s.max_clients })) ?? DEFAULT_SLOTS
  )
  const [tab,     setTab]     = useState<'pattern' | 'slots'>('pattern')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSave() {
    if (!name.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError(null)
    const result = isNew
      ? await createTemplateAction({ name: name.trim(), notes: notes || undefined, days, slots })
      : await updateTemplateAction(template!.id, { name: name.trim(), notes: notes || undefined, days, slots })
    setSaving(false)
    if ('error' in result && result.error) { setError(result.error); return }
    onSaved()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-[#141414] border-l border-white/10 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <p className="text-white font-semibold">{isNew ? 'Nueva plantilla' : `Editar: ${template!.name}`}</p>
            {template?.is_default && <p className="text-[10px] text-[#FF914D]">Plantilla por defecto — los cambios afectan futuros ciclos</p>}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X className="h-5 w-5" /></button>
        </div>

        {/* Name + notes */}
        <div className="px-5 py-4 border-b border-white/[0.06] shrink-0 flex flex-col gap-3">
          <div>
            <label className="text-xs text-white/40 font-medium uppercase tracking-wide mb-1 block">Nombre</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Temporada otoño 2026"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF914D]/50" />
          </div>
          <div>
            <label className="text-xs text-white/40 font-medium uppercase tracking-wide mb-1 block">Notas (opcional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Descripción breve"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#FF914D]/50" />
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex border-b border-white/10 shrink-0">
          {([['pattern', 'Patrón mensual'], ['slots', 'Franjas intradía']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${tab === key ? 'text-[#FF914D] border-[#FF914D]' : 'text-white/40 border-transparent hover:text-white/70'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'pattern' && <PatternEditor days={days} onChange={setDays} />}
          {tab === 'slots'   && <SlotsEditor   slots={slots} onChange={setSlots} />}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 shrink-0">
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs mb-3">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </div>
          )}
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-[#FF914D] hover:bg-[#e07a3a] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            {saving ? 'Guardando...' : isNew ? 'Crear plantilla' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function PlantillasClient({ templates: initialTemplates }: { templates: Template[] }) {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>(initialTemplates)
  const [editing,   setEditing]   = useState<Template | null | 'new'>(null)

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    const result = await deleteTemplateAction(id)
    if ('error' in result && result.error) { alert(result.error); return }
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function handleDuplicate(id: string) {
    const src = templates.find(t => t.id === id)
    const name = prompt('Nombre para la copia:', `${src?.name ?? 'Plantilla'} (copia)`)
    if (!name) return
    const result = await duplicateTemplateAction(id, name)
    if ('error' in result && result.error) { alert(result.error); return }
    router.refresh()
  }

  function onSaved() {
    router.refresh()
  }

  return (
    <div>
      {(editing !== null) && (
        <TemplateEditor
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white font-semibold">Plantillas predefinidas</h2>
          <p className="text-white/40 text-xs mt-0.5">Define el patrón mensual y las franjas intradía de cada ciclo</p>
        </div>
        <button onClick={() => setEditing('new')}
          className="flex items-center gap-2 bg-[#FF914D] hover:bg-[#e07a3a] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-12 text-center">
          <p className="text-white/40">No hay plantillas todavía</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map(t => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={() => setEditing(t)}
              onDuplicate={() => handleDuplicate(t.id)}
              onDelete={() => handleDelete(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
