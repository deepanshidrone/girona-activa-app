'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createExerciseAction } from '@/app/actions/exercises'
import { CreatableSelect, CreatableMultiSelect } from '@/components/creatable-select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Check } from 'lucide-react'
import Link from 'next/link'

type Item = { id: string; name: string }

interface Props {
  movementPatterns: Item[]
  muscleGroups: Item[]
  equipment: Item[]
  objectives: Item[]
}

export default function NuevoEjercicioForm({ movementPatterns, muscleGroups, equipment, objectives }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    name: '',
    movement_pattern_id: '',
    level: '',
    technical_level: '',
    equipment_id: '',
    objective_id: '',
    muscle_group_ids: [] as string[],
    progression: '',
    regression: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await createExerciseAction({
      name: form.name,
      movement_pattern_id: form.movement_pattern_id || undefined,
      level: form.level ? parseInt(form.level) : undefined,
      technical_level: form.technical_level || undefined,
      equipment_id: form.equipment_id || undefined,
      objective_id: form.objective_id || undefined,
      muscle_group_ids: form.muscle_group_ids,
      progression: form.progression || undefined,
      regression: form.regression || undefined,
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/dashboard/ejercicios'), 1500)
  }

  if (success) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-[#1C1C1C] mb-1">Ejercicio creado</h2>
          <p className="text-[#666666] text-xs mt-2">Redirigiendo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/ejercicios" className="text-[#666666] hover:text-[#1C1C1C] transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nuevo ejercicio</h1>
          <p className="text-white/50 text-sm mt-0.5">Solo el nombre es obligatorio</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-[#E5E5E5] p-6 flex flex-col gap-6">

        {/* Nombre */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nombre <span className="text-red-500">*</span></Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Sentadilla con barra"
            required
          />
        </div>

        {/* Patrón de movimiento */}
        <div className="flex flex-col gap-1.5">
          <Label>Patrón de movimiento</Label>
          <CreatableSelect
            table="movement_patterns"
            items={movementPatterns}
            value={form.movement_pattern_id}
            onChange={(val) => setForm({ ...form, movement_pattern_id: val })}
          />
        </div>

        {/* Músculos principales */}
        <div className="flex flex-col gap-1.5">
          <Label>Músculos principales</Label>
          <CreatableMultiSelect
            table="muscle_groups"
            items={muscleGroups}
            values={form.muscle_group_ids}
            onChange={(vals) => setForm({ ...form, muscle_group_ids: vals })}
          />
        </div>

        {/* Nivel mínimo recomendado y Nivel técnico */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Nivel mínimo recomendado</Label>
            <div className="flex gap-2">
              {['1', '2', '3'].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, level: form.level === n ? '' : n })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.level === n
                      ? 'bg-[#FF914D] text-white'
                      : 'bg-[#F5F5F5] text-[#1C1C1C] hover:bg-[#E5E5E5]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Nivel técnico</Label>
            <div className="flex gap-2">
              {[{ val: 'basico', label: 'Básico' }, { val: 'intermedio', label: 'Inter.' }, { val: 'avanzado', label: 'Avanz.' }].map((n) => (
                <button
                  key={n.val}
                  type="button"
                  onClick={() => setForm({ ...form, technical_level: form.technical_level === n.val ? '' : n.val })}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                    form.technical_level === n.val
                      ? 'bg-[#FF914D] text-white'
                      : 'bg-[#F5F5F5] text-[#1C1C1C] hover:bg-[#E5E5E5]'
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Equipamiento */}
        <div className="flex flex-col gap-1.5">
          <Label>Equipamiento</Label>
          <CreatableSelect
            table="equipment"
            items={equipment}
            value={form.equipment_id}
            onChange={(val) => setForm({ ...form, equipment_id: val })}
          />
        </div>

        {/* Objetivo principal */}
        <div className="flex flex-col gap-1.5">
          <Label>Objetivo principal</Label>
          <CreatableSelect
            table="objectives"
            items={objectives}
            value={form.objective_id}
            onChange={(val) => setForm({ ...form, objective_id: val })}
          />
        </div>

        {/* Progresión y Regresión */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="progression">Ejercicio progresión</Label>
            <Input
              id="progression"
              value={form.progression}
              onChange={(e) => setForm({ ...form, progression: e.target.value })}
              placeholder="Versión más difícil..."
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="regression">Ejercicio regresión</Label>
            <Input
              id="regression"
              value={form.regression}
              onChange={(e) => setForm({ ...form, regression: e.target.value })}
              placeholder="Versión más fácil..."
            />
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            type="submit"
            disabled={loading || !form.name.trim()}
            className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold flex-1"
          >
            {loading ? 'Creando...' : 'Crear ejercicio'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
