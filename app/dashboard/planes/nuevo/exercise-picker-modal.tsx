'use client'

import { useState } from 'react'
import { X, Search, Plus, Check, ChevronLeft } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

type Item = { id: string; name: string }
type Exercise = {
  id: string
  name: string
  technical_name: string | null
  level: number | null
  technical_level: string | null
  body_zone_id: string | null
  movement_pattern_id: string | null
  equipment_id: string | null
  objective_id: string | null
  muscle_group_ids: string[]
}

interface Props {
  exercises: Exercise[]
  bodyZones: Item[]
  movementPatterns: Item[]
  muscleGroups: Item[]
  equipment: Item[]
  objectives: Item[]
  dayLabel: string
  onAdd: (exercise: Exercise, sets: number, reps: number, weight_kg: string, notes: string) => void
  onClose: () => void
}

const LEVEL_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Groc', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
  2: { label: 'Blau', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  3: { label: 'Vermell', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
}

export function ExercisePickerModal({
  exercises, bodyZones, movementPatterns, muscleGroups, equipment, objectives, dayLabel, onAdd, onClose
}: Props) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    body_zone_id: '',
    movement_pattern_id: '',
    muscle_group_id: '',
    equipment_id: '',
    objective_id: '',
    level: '',
  })
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [form, setForm] = useState({ sets: 3, reps: 10, weight_kg: '', notes: '' })

  const activeFilters = Object.values(filters).filter(Boolean).length

  const filtered = exercises.filter(ex => {
    if (search) {
      const q = search.toLowerCase()
      if (!ex.name.toLowerCase().includes(q) && !(ex.technical_name ?? '').toLowerCase().includes(q)) return false
    }
    if (filters.body_zone_id && ex.body_zone_id !== filters.body_zone_id) return false
    if (filters.movement_pattern_id && ex.movement_pattern_id !== filters.movement_pattern_id) return false
    if (filters.muscle_group_id && !ex.muscle_group_ids.includes(filters.muscle_group_id)) return false
    if (filters.equipment_id && ex.equipment_id !== filters.equipment_id) return false
    if (filters.objective_id && ex.objective_id !== filters.objective_id) return false
    if (filters.level && ex.level !== parseInt(filters.level)) return false
    return true
  })

  function handleAdd() {
    if (!selected) return
    onAdd(selected, form.sets, form.reps, form.weight_kg, form.notes)
    setSelected(null)
    setForm({ sets: 3, reps: 10, weight_kg: '', notes: '' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-5xl bg-[#1C1C1C] rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="font-bold text-white text-lg">Agregar ejercicio</h2>
            <p className="text-white/40 text-sm">{dayLabel}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar filtros */}
          <aside className="w-48 shrink-0 border-r border-white/10 p-4 flex flex-col gap-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">Filtros</span>
              {activeFilters > 0 && (
                <button
                  onClick={() => setFilters({ body_zone_id: '', movement_pattern_id: '', muscle_group_id: '', equipment_id: '', objective_id: '', level: '' })}
                  className="text-[10px] text-[#FF914D] hover:underline"
                >
                  Limpiar
                </button>
              )}
            </div>

            <FilterSelect label="Parte del cuerpo" items={bodyZones} value={filters.body_zone_id}
              onChange={v => setFilters(f => ({ ...f, body_zone_id: v }))} />

            {/* Nivel */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Nivel</p>
              <div className="flex gap-1">
                {[{ v: '1', l: 'G' }, { v: '2', l: 'B' }, { v: '3', l: 'V' }].map(({ v, l }) => (
                  <button key={v}
                    onClick={() => setFilters(f => ({ ...f, level: f.level === v ? '' : v }))}
                    className={`flex-1 py-1 rounded text-[10px] font-bold transition-colors border ${
                      filters.level === v
                        ? v === '1' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          : v === '2' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : 'bg-red-500/20 text-red-400 border-red-500/30'
                        : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                    }`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <FilterSelect label="Patrón" items={movementPatterns} value={filters.movement_pattern_id}
              onChange={v => setFilters(f => ({ ...f, movement_pattern_id: v }))} />
            <FilterSelect label="Músculo" items={muscleGroups} value={filters.muscle_group_id}
              onChange={v => setFilters(f => ({ ...f, muscle_group_id: v }))} />
            <FilterSelect label="Equipamiento" items={equipment} value={filters.equipment_id}
              onChange={v => setFilters(f => ({ ...f, equipment_id: v }))} />
            <FilterSelect label="Objetivo" items={objectives} value={filters.objective_id}
              onChange={v => setFilters(f => ({ ...f, objective_id: v }))} />
          </aside>

          {/* Main */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Search */}
            <div className="px-4 py-3 border-b border-white/10 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar por nombre..."
                  autoFocus
                  className="w-full bg-[#111111] border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-[#FF914D] transition-colors"
                />
              </div>
              <p className="text-[11px] text-white/30 mt-1.5">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
            </div>

            {selected ? (
              /* Form sets/reps */
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-sm">
                  <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-4 transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Volver
                  </button>
                  <div className="bg-[#FF914D]/10 border border-[#FF914D]/20 rounded-xl p-4 mb-4">
                    <p className="font-semibold text-white">{selected.name}</p>
                    {selected.technical_name && <p className="text-xs text-white/40 italic mt-0.5">{selected.technical_name}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-white/60">Series</Label>
                      <input type="number" value={form.sets} min={1} max={20}
                        onChange={e => setForm(f => ({ ...f, sets: parseInt(e.target.value) || 1 }))}
                        className="bg-[#111111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF914D] transition-colors" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-white/60">Repeticiones</Label>
                      <input type="number" value={form.reps} min={1} max={100}
                        onChange={e => setForm(f => ({ ...f, reps: parseInt(e.target.value) || 1 }))}
                        className="bg-[#111111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#FF914D] transition-colors" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 mb-3">
                    <Label className="text-xs text-white/60">Peso (kg) — opcional</Label>
                    <input type="number" value={form.weight_kg} placeholder="Ej: 60" step={0.5}
                      onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
                      className="bg-[#111111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#FF914D] transition-colors" />
                  </div>
                  <div className="flex flex-col gap-1.5 mb-4">
                    <Label className="text-xs text-white/60">Notas — opcional</Label>
                    <input value={form.notes} placeholder="Indicaciones..."
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      className="bg-[#111111] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-[#FF914D] transition-colors" />
                  </div>
                  <Button onClick={handleAdd} className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-bold w-full gap-2">
                    <Check className="h-4 w-4" /> Agregar al día
                  </Button>
                </div>
              </div>
            ) : (
              /* Exercise grid */
              <div className="flex-1 overflow-y-auto p-4">
                {filtered.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-white/30 text-sm">No hay ejercicios con estos filtros</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                    {filtered.map(ex => {
                      const lvl = ex.level ? LEVEL_LABELS[ex.level] : null
                      return (
                        <button
                          key={ex.id}
                          onClick={() => { setSelected(ex); setForm({ sets: 3, reps: 10, weight_kg: '', notes: '' }) }}
                          className="bg-[#111111] border border-white/10 rounded-xl p-3 text-left hover:border-[#FF914D]/50 hover:bg-[#FF914D]/5 transition-all group"
                        >
                          <div className="flex items-start justify-between gap-1 mb-2">
                            {lvl ? (
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${lvl.color}`}>
                                {lvl.label}
                              </span>
                            ) : <span />}
                            <Plus className="h-3.5 w-3.5 text-[#FF914D] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                          <p className="text-sm font-semibold text-white leading-tight">{ex.name}</p>
                          {ex.technical_name && (
                            <p className="text-[10px] text-white/30 italic mt-0.5 leading-tight">{ex.technical_name}</p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterSelect({ label, items, value, onChange }: { label: string; items: Item[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">{label}</p>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="text-xs border border-white/10 rounded-lg px-2 py-1.5 bg-[#111111] text-white outline-none focus:border-[#FF914D]">
        <option value="">Tots</option>
        {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </div>
  )
}
