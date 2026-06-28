'use client'

import { useState } from 'react'
import { Dumbbell, X } from 'lucide-react'
import Link from 'next/link'

type Item = { id: string; name: string }
type Exercise = {
  id: string
  name: string
  level: number | null
  technical_level: string | null
  progression: string | null
  regression: string | null
  movement_patterns: Item | null
  equipment: Item | null
  objectives: Item | null
  exercise_muscle_groups: { muscle_groups: Item | null }[]
}

interface Props {
  exercises: Exercise[]
  movementPatterns: Item[]
  muscleGroups: Item[]
  equipment: Item[]
  objectives: Item[]
}

const TECHNICAL_LABELS: Record<string, string> = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

export function EjerciciosGallery({ exercises, movementPatterns, muscleGroups, equipment, objectives }: Props) {
  const [filters, setFilters] = useState({
    movement_pattern_id: '',
    muscle_group_id: '',
    equipment_id: '',
    objective_id: '',
    level: '',
    technical_level: '',
  })

  function clearFilters() {
    setFilters({ movement_pattern_id: '', muscle_group_id: '', equipment_id: '', objective_id: '', level: '', technical_level: '' })
  }

  const activeFilters = Object.values(filters).filter(Boolean).length

  const filtered = exercises.filter((ex) => {
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
      <aside className="w-56 shrink-0">
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 flex flex-col gap-4 sticky top-20">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1C1C1C]">Filtros</h3>
            {activeFilters > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-[#FF914D] hover:underline">
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}
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
            <p className="text-xs font-medium text-[#666666] uppercase tracking-wider">Nivel mín.</p>
            <div className="flex gap-1">
              {['1', '2', '3'].map((n) => (
                <button key={n} onClick={() => setFilters({ ...filters, level: filters.level === n ? '' : n })}
                  className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${filters.level === n ? 'bg-[#FF914D] text-white' : 'bg-[#F5F5F5] text-[#666666] hover:bg-[#E5E5E5]'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-[#666666] uppercase tracking-wider">Nivel técnico</p>
            <div className="flex flex-col gap-1">
              {[{ val: 'basico', label: 'Básico' }, { val: 'intermedio', label: 'Intermedio' }, { val: 'avanzado', label: 'Avanzado' }].map((n) => (
                <button key={n.val} onClick={() => setFilters({ ...filters, technical_level: filters.technical_level === n.val ? '' : n.val })}
                  className={`py-1 rounded text-xs font-medium transition-colors ${filters.technical_level === n.val ? 'bg-[#FF914D] text-white' : 'bg-[#F5F5F5] text-[#666666] hover:bg-[#E5E5E5]'}`}>
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Grid ejercicios */}
      <div className="flex-1">
        <p className="text-sm text-[#666666] mb-3">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</p>
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-8 text-center">
            <p className="text-[#666666] text-sm">No hay ejercicios con estos filtros</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((ex) => (
              <div key={ex.id} className="bg-white rounded-xl border border-[#E5E5E5] p-4 flex flex-col gap-2 hover:border-[#FF914D] transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#FF914D]/10 flex items-center justify-center shrink-0">
                    <Dumbbell className="h-4 w-4 text-[#FF914D]" />
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {ex.level && (
                      <span className="text-xs bg-[#F5F5F5] text-[#666666] px-2 py-0.5 rounded-full">Niv. {ex.level}</span>
                    )}
                    {ex.technical_level && (
                      <span className="text-xs bg-[#F5F5F5] text-[#666666] px-2 py-0.5 rounded-full">{TECHNICAL_LABELS[ex.technical_level]}</span>
                    )}
                  </div>
                </div>

                <h3 className="font-semibold text-[#1C1C1C] text-sm leading-tight">{ex.name}</h3>

                <div className="flex flex-wrap gap-1 mt-auto pt-1">
                  {ex.movement_patterns && (
                    <span className="text-xs bg-orange-50 text-[#FF914D] px-2 py-0.5 rounded-full">{ex.movement_patterns.name}</span>
                  )}
                  {ex.exercise_muscle_groups.slice(0, 2).map((mg, i) => mg.muscle_groups && (
                    <span key={i} className="text-xs bg-[#F5F5F5] text-[#666666] px-2 py-0.5 rounded-full">{mg.muscle_groups.name}</span>
                  ))}
                  {ex.exercise_muscle_groups.length > 2 && (
                    <span className="text-xs bg-[#F5F5F5] text-[#666666] px-2 py-0.5 rounded-full">+{ex.exercise_muscle_groups.length - 2}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FilterGroup({ label, items, value, onChange }: { label: string; items: Item[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-[#666666] uppercase tracking-wider">{label}</p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs border border-[#E5E5E5] rounded-lg px-2 py-1.5 outline-none focus:border-[#FF914D] bg-white text-[#1C1C1C]"
      >
        <option value="">Todos</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>{item.name}</option>
        ))}
      </select>
    </div>
  )
}
