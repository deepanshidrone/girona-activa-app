'use client'

import { useState } from 'react'
import { Dumbbell, X, Search, ChevronDown, ChevronUp } from 'lucide-react'

type Item = { id: string; name: string }
type Exercise = {
  id: string
  name: string
  technical_name: string | null
  exercise_code: string | null
  subpattern: string | null
  level: number | null
  technical_level: string | null
  progression: string | null
  regression: string | null
  secondary_muscles: string | null
  body_zone_id: string | null
  movement_patterns: Item | null
  equipment: Item | null
  objectives: Item | null
  exercise_muscle_groups: { muscle_groups: Item | null }[]
}

interface Props {
  exercises: Exercise[]
  bodyZones: Item[]
  movementPatterns: Item[]
  muscleGroups: Item[]
  equipment: Item[]
  objectives: Item[]
}

const LEVEL_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Groc', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
  2: { label: 'Blau', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  3: { label: 'Vermell', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
}

const TECH_LABELS: Record<string, string> = {
  basico: 'Tèc. 1-2',
  intermedio: 'Tèc. 3',
  avanzado: 'Tèc. 4-5',
}

export function EjerciciosGallery({ exercises, bodyZones, movementPatterns, muscleGroups, equipment, objectives }: Props) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({
    body_zone_id: '',
    movement_pattern_id: '',
    muscle_group_id: '',
    equipment_id: '',
    objective_id: '',
    level: '',
    technical_level: '',
  })
  const [expanded, setExpanded] = useState<string | null>(null)

  function clearFilters() {
    setFilters({ body_zone_id: '', movement_pattern_id: '', muscle_group_id: '', equipment_id: '', objective_id: '', level: '', technical_level: '' })
    setSearch('')
  }

  const activeFilters = Object.values(filters).filter(Boolean).length + (search ? 1 : 0)

  const filtered = exercises.filter((ex) => {
    if (search) {
      const q = search.toLowerCase()
      if (!ex.name.toLowerCase().includes(q) && !(ex.technical_name ?? '').toLowerCase().includes(q)) return false
    }
    if (filters.body_zone_id && ex.body_zone_id !== filters.body_zone_id) return false
    if (filters.movement_pattern_id && ex.movement_patterns?.id !== filters.movement_pattern_id) return false
    if (filters.muscle_group_id && !ex.exercise_muscle_groups.some(mg => mg.muscle_groups?.id === filters.muscle_group_id)) return false
    if (filters.equipment_id && ex.equipment?.id !== filters.equipment_id) return false
    if (filters.objective_id && ex.objectives?.id !== filters.objective_id) return false
    if (filters.level && ex.level !== parseInt(filters.level)) return false
    if (filters.technical_level && ex.technical_level !== filters.technical_level) return false
    return true
  })

  return (
    <div className="flex gap-5">
      {/* Sidebar filtros */}
      <aside className="w-52 shrink-0">
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4 flex flex-col gap-4 sticky top-20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Filtros</h3>
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-[#FF914D] hover:underline">
                <X className="h-3 w-3" /> Limpiar ({activeFilters})
              </button>
            )}
          </div>

          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full bg-[#111111] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-[#FF914D] transition-colors"
            />
          </div>

          <FilterGroup label="Parte del cuerpo" items={bodyZones} value={filters.body_zone_id}
            onChange={(v) => setFilters({ ...filters, body_zone_id: v })} />

          {/* Nivel mínimo */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Nivel</p>
            <div className="flex gap-1">
              {[{ v: '1', l: 'Groc' }, { v: '2', l: 'Blau' }, { v: '3', l: 'Verm.' }].map(({ v, l }) => (
                <button key={v}
                  onClick={() => setFilters({ ...filters, level: filters.level === v ? '' : v })}
                  className={`flex-1 py-1 rounded text-[10px] font-semibold transition-colors border ${
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

          <FilterGroup label="Patrón" items={movementPatterns} value={filters.movement_pattern_id}
            onChange={(v) => setFilters({ ...filters, movement_pattern_id: v })} />

          <FilterGroup label="Músculo" items={muscleGroups} value={filters.muscle_group_id}
            onChange={(v) => setFilters({ ...filters, muscle_group_id: v })} />

          <FilterGroup label="Equipamiento" items={equipment} value={filters.equipment_id}
            onChange={(v) => setFilters({ ...filters, equipment_id: v })} />

          <FilterGroup label="Objetivo" items={objectives} value={filters.objective_id}
            onChange={(v) => setFilters({ ...filters, objective_id: v })} />

          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Nivel técnico</p>
            <div className="flex flex-col gap-1">
              {[{ val: 'basico', label: 'Básico (1-2)' }, { val: 'intermedio', label: 'Intermedio (3)' }, { val: 'avanzado', label: 'Avanzado (4-5)' }].map((n) => (
                <button key={n.val}
                  onClick={() => setFilters({ ...filters, technical_level: filters.technical_level === n.val ? '' : n.val })}
                  className={`py-1 rounded text-[10px] font-medium transition-colors border ${
                    filters.technical_level === n.val
                      ? 'bg-[#FF914D]/20 text-[#FF914D] border-[#FF914D]/30'
                      : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                  }`}>
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Grid ejercicios */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-white/40 mb-3">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
        {filtered.length === 0 ? (
          <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-8 text-center">
            <p className="text-white/40 text-sm">No hay ejercicios con estos filtros</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((ex) => {
              const lvl = ex.level ? LEVEL_LABELS[ex.level] : null
              const isOpen = expanded === ex.id
              return (
                <div key={ex.id}
                  className="bg-[#1C1C1C] rounded-xl border border-white/10 p-4 flex flex-col gap-2 hover:border-[#FF914D]/40 transition-colors">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {lvl && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${lvl.color}`}>
                          {lvl.label}
                        </span>
                      )}
                      {ex.technical_level && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10 text-white/40">
                          {TECH_LABELS[ex.technical_level]}
                        </span>
                      )}
                    </div>
                    {ex.exercise_code && (
                      <span className="text-[9px] text-white/20 font-mono shrink-0">{ex.exercise_code}</span>
                    )}
                  </div>

                  {/* Nombre */}
                  <div>
                    <h3 className="font-semibold text-white text-sm leading-tight">{ex.name}</h3>
                    {ex.technical_name && (
                      <p className="text-[11px] text-white/30 mt-0.5 italic">{ex.technical_name}</p>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mt-auto pt-1">
                    {ex.movement_patterns && (
                      <span className="text-[10px] bg-[#FF914D]/10 text-[#FF914D] px-2 py-0.5 rounded-full border border-[#FF914D]/20">
                        {ex.movement_patterns.name}
                      </span>
                    )}
                    {ex.exercise_muscle_groups.slice(0, 2).map((mg, i) => mg.muscle_groups && (
                      <span key={i} className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full border border-white/10">
                        {mg.muscle_groups.name}
                      </span>
                    ))}
                    {ex.exercise_muscle_groups.length > 2 && (
                      <span className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full border border-white/10">
                        +{ex.exercise_muscle_groups.length - 2}
                      </span>
                    )}
                  </div>

                  {/* Expandir */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : ex.id)}
                    className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors mt-1 w-fit"
                  >
                    {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {isOpen ? 'Menos' : 'Más info'}
                  </button>

                  {isOpen && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-white/10 text-xs">
                      {ex.subpattern && <InfoRow label="Subpatró" value={ex.subpattern} />}
                      {ex.equipment && <InfoRow label="Equipament" value={ex.equipment.name} />}
                      {ex.objectives && <InfoRow label="Objectiu" value={ex.objectives.name} />}
                      {ex.progression && <InfoRow label="Progressió" value={ex.progression} />}
                      {ex.regression && <InfoRow label="Regressió" value={ex.regression} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterGroup({ label, items, value, onChange }: { label: string; items: Item[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs border border-white/10 rounded-lg px-2 py-1.5 outline-none focus:border-[#FF914D] bg-[#111111] text-white"
      >
        <option value="">Tots</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-white/30 shrink-0 w-20">{label}</span>
      <span className="text-white/70">{value}</span>
    </div>
  )
}
