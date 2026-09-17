import { createAdminClient } from '@/lib/supabase/admin'
import { PlanWizard } from './wizard'

export const dynamic = 'force-dynamic'

export default async function NuevoPlanPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client: preselectedClientId } = await searchParams
  const supabase = createAdminClient()

  const [
    { data: clients },
    { data: exercises },
    { data: bodyZones },
    { data: muscleGroups },
    { data: movementPatterns },
    { data: equipment },
    { data: objectives },
    { data: muscleLinks },
    { data: cycles },
    { data: employees },
  ] = await Promise.all([
    supabase.from('clients').select('id, first_name, last_name').eq('is_active', true).order('first_name'),
    supabase.from('exercises').select('id, name, technical_name, level, technical_level, body_zone_id, movement_pattern_id, equipment_id, objective_id').order('name'),
    supabase.from('body_zones').select('id, name').order('name'),
    supabase.from('muscle_groups').select('id, name').order('name'),
    supabase.from('movement_patterns').select('id, name').order('name'),
    supabase.from('equipment').select('id, name').order('name'),
    supabase.from('objectives').select('id, name').order('name'),
    supabase.from('exercise_muscle_groups').select('exercise_id, muscle_group_id'),
    supabase.from('group_cycles').select('id, start_date, notes').order('start_date', { ascending: false }),
    supabase.from('profiles').select('id, full_name').neq('full_name', null).order('full_name'),
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
      bodyZones={bodyZones ?? []}
      muscleGroups={muscleGroups ?? []}
      movementPatterns={movementPatterns ?? []}
      equipment={equipment ?? []}
      objectives={objectives ?? []}
      cycles={cycles ?? []}
      employees={employees ?? []}
      preselectedClientId={preselectedClientId}
    />
  )
}
