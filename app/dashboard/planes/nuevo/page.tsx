import { createClient } from '@/lib/supabase/server'
import { PlanWizard } from './wizard'

export default async function NuevoPlanPage() {
  const supabase = await createClient()

  const [
    { data: clients },
    { data: exercises },
    { data: muscleGroups },
    { data: movementPatterns },
  ] = await Promise.all([
    supabase.from('clients').select('id, first_name, last_name').eq('is_active', true).order('first_name'),
    supabase.from('exercises').select('id, name, level, technical_level, movement_pattern_id, equipment_id, objective_id').order('name'),
    supabase.from('muscle_groups').select('id, name').order('name'),
    supabase.from('movement_patterns').select('id, name').order('name'),
  ])

  return (
    <PlanWizard
      clients={clients ?? []}
      exercises={exercises ?? []}
      muscleGroups={muscleGroups ?? []}
      movementPatterns={movementPatterns ?? []}
    />
  )
}
