import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Dumbbell } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EjerciciosGallery } from './gallery'

export default async function EjerciciosPage() {
  const supabase = await createClient()

  const [
    { data: exercises, error: exError },
    { data: movementPatterns },
    { data: muscleGroups },
    { data: equipment },
    { data: objectives },
  ] = await Promise.all([
    supabase.from('exercises').select(`
      id, name, level, technical_level, progression, regression,
      movement_pattern_id, equipment_id, objective_id
    `).order('name'),
    supabase.from('movement_patterns').select('id, name').order('name'),
    supabase.from('muscle_groups').select('id, name').order('name'),
    supabase.from('equipment').select('id, name').order('name'),
    supabase.from('objectives').select('id, name').order('name'),
  ])

  // Fetch muscle groups per exercise separately
  const exercisesWithData = await Promise.all(
    (exercises ?? []).map(async (ex) => {
      const { data: mgs } = await supabase
        .from('exercise_muscle_groups')
        .select('muscle_group_id')
        .eq('exercise_id', ex.id)

      return {
        ...ex,
        movement_patterns: movementPatterns?.find(mp => mp.id === ex.movement_pattern_id) ?? null,
        equipment: equipment?.find(eq => eq.id === ex.equipment_id) ?? null,
        objectives: objectives?.find(ob => ob.id === ex.objective_id) ?? null,
        exercise_muscle_groups: (mgs ?? []).map(mg => ({
          muscle_groups: muscleGroups?.find(m => m.id === mg.muscle_group_id) ?? null
        }))
      }
    })
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]">Ejercicios</h1>
          <p className="text-[#666666] text-sm mt-1">
            {exercisesWithData?.length ?? 0} ejercicio{exercisesWithData?.length !== 1 ? 's' : ''} en la galería
          </p>
        </div>
        <Link href="/dashboard/ejercicios/nuevo">
          <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
            <Plus className="h-4 w-4" />
            Nuevo ejercicio
          </Button>
        </Link>
      </div>

      {!exercisesWithData || exercisesWithData.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#FF914D]/10 flex items-center justify-center mb-4">
            <Dumbbell className="h-6 w-6 text-[#FF914D]" />
          </div>
          <h3 className="text-[#1C1C1C] font-semibold mb-1">No hay ejercicios todavía</h3>
          <p className="text-[#666666] text-sm mb-4">Empieza añadiendo ejercicios a la galería</p>
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
          movementPatterns={movementPatterns ?? []}
          muscleGroups={muscleGroups ?? []}
          equipment={equipment ?? []}
          objectives={objectives ?? []}
        />
      )}
    </div>
  )
}
