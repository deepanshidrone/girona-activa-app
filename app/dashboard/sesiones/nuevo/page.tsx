import { createAdminClient } from '@/lib/supabase/admin'
import { CycleForm } from './cycle-form'

export const dynamic = 'force-dynamic'

export default async function NuevoSesionesPage() {
  const supabase = createAdminClient()

  const [
    { data: exercises },
    { data: bodyZones },
    { data: muscleGroups },
    { data: movementPatterns },
    { data: equipment },
    { data: objectives },
    { data: muscleLinks },
  ] = await Promise.all([
    supabase.from('exercises').select('id, name, technical_name, level, technical_level, body_zone_id, movement_pattern_id, equipment_id, objective_id').order('name'),
    supabase.from('body_zones').select('id, name').order('name'),
    supabase.from('muscle_groups').select('id, name').order('name'),
    supabase.from('movement_patterns').select('id, name').order('name'),
    supabase.from('equipment').select('id, name').order('name'),
    supabase.from('objectives').select('id, name').order('name'),
    supabase.from('exercise_muscle_groups').select('exercise_id, muscle_group_id'),
  ])

  const exercisesWithMuscles = (exercises ?? []).map(ex => ({
    ...ex,
    muscle_group_ids: (muscleLinks ?? [])
      .filter(ml => ml.exercise_id === ex.id)
      .map(ml => ml.muscle_group_id),
  }))

  return (
    <CycleForm
      exercises={exercisesWithMuscles}
      bodyZones={bodyZones ?? []}
      muscleGroups={muscleGroups ?? []}
      movementPatterns={movementPatterns ?? []}
      equipment={equipment ?? []}
      objectives={objectives ?? []}
    />
  )
}
