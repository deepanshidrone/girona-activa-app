import { createAdminClient } from '@/lib/supabase/admin'
import { PlanWizard } from './wizard'

export default async function NuevoPlanPage() {
  const supabase = createAdminClient()

  const [
    { data: clients },
    { data: exercises },
    { data: muscleGroups },
    { data: movementPatterns },
    { data: equipment },
    { data: objectives },
    { data: muscleLinks },
  ] = await Promise.all([
    supabase.from('clients').select('id, first_name, last_name').eq('is_active', true).order('first_name'),
    supabase.from('exercises').select('id, name, technical_name, level, technical_level, movement_pattern_id, equipment_id, objective_id').order('name'),
    supabase.from('muscle_groups').select('id, name').order('name'),
    supabase.from('movement_patterns').select('id, name').order('name'),
    supabase.from('equipment').select('id, name').order('name'),
    supabase.from('objectives').select('id, name').order('name'),
    supabase.from('exercise_muscle_groups').select('exercise_id, muscle_group_id'),
  ])

  // Enriquecer ejercicios con grupos musculares
  const exercisesWithMuscles = (exercises ?? []).map(ex => ({
    ...ex,
    muscle_group_ids: (muscleLinks ?? [])
      .filter(ml => ml.exercise_id === ex.id)
      .map(ml => ml.muscle_group_id),
  }))

  return (
    <PlanWizard
      clients={clients ?? []}
      exercises={exercisesWithMuscles}
      muscleGroups={muscleGroups ?? []}
      movementPatterns={movementPatterns ?? []}
      equipment={equipment ?? []}
      objectives={objectives ?? []}
    />
  )
}
