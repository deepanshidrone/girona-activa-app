'use client'

import { useState } from 'react'
import { createCatalogItemAction } from '@/app/actions/exercises'
import { Plus, Check } from 'lucide-react'

type Item = { id: string; name: string }
type Table = 'movement_patterns' | 'equipment' | 'objectives' | 'muscle_groups'

interface CreatableSelectProps {
  table: Table
  items: Item[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

interface CreatableMultiSelectProps {
  table: Table
  items: Item[]
  values: string[]
  onChange: (values: string[]) => void
}

export function CreatableMultiSelect({ table, items, values, onChange }: CreatableMultiSelectProps) {
  const [localItems, setLocalItems] = useState<Item[]>(items)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)

  function toggle(id: string) {
    onChange(values.includes(id) ? values.filter(v => v !== id) : [...values, id])
  }

  async function handleCreate() {
    if (!newName.trim()) return
    setLoading(true)
    const result = await createCatalogItemAction(table, newName.trim())
    if (result.success && result.item) {
      setLocalItems([...localItems, result.item])
      onChange([...values, result.item.id])
    }
    setNewName('')
    setCreating(false)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {localItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => toggle(item.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
              values.includes(item.id)
                ? 'bg-[#FF914D] text-white'
                : 'bg-[#F5F5F5] text-[#1C1C1C] hover:bg-[#E5E5E5]'
            }`}
          >
            {values.includes(item.id) && <Check className="h-3 w-3 shrink-0" />}
            {item.name}
          </button>
        ))}
      </div>

      {creating ? (
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nombre del músculo..."
            className="flex-1 border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#FF914D]"
            autoFocus
          />
          <button type="button" onClick={handleCreate} disabled={loading || !newName.trim()}
            className="bg-[#FF914D] text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50">
            {loading ? '...' : 'Crear'}
          </button>
          <button type="button" onClick={() => { setCreating(false); setNewName('') }}
            className="text-[#666666] px-3 py-1.5 rounded-lg text-sm hover:bg-[#F5F5F5]">
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-sm text-[#FF914D] hover:underline w-fit mt-1">
          <Plus className="h-3.5 w-3.5" />
          Crear nueva opción
        </button>
      )}
    </div>
  )
}

export function CreatableSelect({ table, items, value, onChange, placeholder }: CreatableSelectProps) {
  const [localItems, setLocalItems] = useState<Item[]>(items)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!newName.trim()) return
    setLoading(true)
    const result = await createCatalogItemAction(table, newName.trim())
    if (result.success && result.item) {
      setLocalItems([...localItems, result.item])
      onChange(result.item.id)
    }
    setNewName('')
    setCreating(false)
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-[#E5E5E5] rounded-lg p-2 bg-white">
        {localItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(value === item.id ? '' : item.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-left transition-colors ${
              value === item.id
                ? 'bg-[#FF914D] text-white'
                : 'bg-[#F5F5F5] text-[#1C1C1C] hover:bg-[#E5E5E5]'
            }`}
          >
            {value === item.id && <Check className="h-3 w-3 shrink-0" />}
            {item.name}
          </button>
        ))}
      </div>

      {creating ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nombre de la nueva opción..."
            className="flex-1 border border-[#E5E5E5] rounded-lg px-3 py-1.5 text-sm outline-none focus:border-[#FF914D]"
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={loading || !newName.trim()}
            className="bg-[#FF914D] text-white px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {loading ? '...' : 'Crear'}
          </button>
          <button
            type="button"
            onClick={() => { setCreating(false); setNewName('') }}
            className="text-[#666666] px-3 py-1.5 rounded-lg text-sm hover:bg-[#F5F5F5]"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 text-sm text-[#FF914D] hover:underline w-fit"
        >
          <Plus className="h-3.5 w-3.5" />
          Crear nueva opción
        </button>
      )}
    </div>
  )
}
