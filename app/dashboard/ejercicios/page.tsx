import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Dumbbell } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { EjerciciosGallery } from './gallery'

export default async function EjerciciosPage() {
  const supabase = createAdminClient()

  const [
    { data: exercises },
    { data: bodyZones },
    { data: movementPatterns },
    { data: muscleGroups },
    { data: equipmentRes },
    { data: objectivesRes },
    { data: muscleLinksRes },
  ] = await Promise.all([
    supabase.from('exercises').select(
      'id, name, technical_name, exercise_code, subpattern, level, technical_level, progression, regression, secondary_muscles, body_zone_id, movement_pattern_id, equipment_id, objective_id'
    ).order('name'),
    supabase.from('body_zones').select('id, name').order('name'),
    supabase.from('movement_patterns').select('id, name').order('name'),
    supabase.from('muscle_groups').select('id, name').order('name'),
    supabase.from('equipment').select('id, name').order('name'),
    supabase.from('objectives').select('id, name').order('name'),
    supabase.from('exercise_muscle_groups').select('exercise_id, muscle_group_id'),
  ])

  const exercisesWithData = (exercises ?? []).map((ex) => ({
    ...ex,
    movement_patterns: movementPatterns?.find(mp => mp.id === ex.movement_pattern_id) ?? null,
    equipment: equipmentRes?.find(eq => eq.id === ex.equipment_id) ?? null,
    objectives: objectivesRes?.find(ob => ob.id === ex.objective_id) ?? null,
    exercise_muscle_groups: (muscleLinksRes ?? [])
      .filter(ml => ml.exercise_id === ex.id)
      .map(ml => ({ muscle_groups: muscleGroups?.find(m => m.id === ml.muscle_group_id) ?? null })),
  }))

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Ejercicios</h1>
          <p className="text-white/50 text-sm mt-1">
            {exercisesWithData.length} ejercicio{exercisesWithData.length !== 1 ? 's' : ''} en la galería
          </p>
        </div>
        <Link href="/dashboard/ejercicios/nuevo">
          <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
            <Plus className="h-4 w-4" />
            Nuevo ejercicio
          </Button>
        </Link>
      </div>

      {exercisesWithData.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#FF914D]/10 flex items-center justify-center mb-4">
            <Dumbbell className="h-6 w-6 text-[#FF914D]" />
          </div>
          <h3 className="text-white font-semibold mb-1">No hay ejercicios todavía</h3>
          <p className="text-white/40 text-sm mb-4">Empieza añadiendo ejercicios a la galería</p>
          <Link href="/dashboard/ejercicios/nuevo">
            <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
              <Plus className="h-4 w-4" />
              Nuevo ejercicio
            </Button>
          </Link>
        </div>
      ) : (
        <EjerciciosGallery
          exercises={exercisesWithData as any}
          bodyZones={bodyZones ?? []}
          movementPatterns={movementPatterns ?? []}
          muscleGroups={muscleGroups ?? []}
          equipment={equipmentRes ?? []}
          objectives={objectivesRes ?? []}
        />
      )}
    </div>
  )
}
