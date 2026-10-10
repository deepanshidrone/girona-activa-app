import { notFound } from 'next/navigation'
import { getGroupCycleByIdAction } from '@/app/actions/group-sessions'
import { getHolidaysAction } from '@/app/actions/holidays'
import { createAdminClient } from '@/lib/supabase/admin'
import CycleEditor from './cycle-editor'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const [
    { cycle, error }, exercisesResult, employeesResult, clientsResult, holidays,
    { data: bodyZones }, { data: muscleGroups }, { data: movementPatterns },
    { data: equipment }, { data: objectives }, { data: muscleLinks },
  ] = await Promise.all([
    getGroupCycleByIdAction(id),
    supabase.from('exercises').select('id, name, technical_name, level, technical_level, body_zone_id, movement_pattern_id, equipment_id, objective_id').order('name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'employee').order('full_name'),
    supabase.from('clients').select('id, first_name, last_name').eq('is_active', true).order('first_name'),
    getHolidaysAction(2026, 2027),
    supabase.from('body_zones').select('id, name').order('name'),
    supabase.from('muscle_groups').select('id, name').order('name'),
    supabase.from('movement_patterns').select('id, name').order('name'),
    supabase.from('equipment').select('id, name').order('name'),
    supabase.from('objectives').select('id, name').order('name'),
    supabase.from('exercise_muscle_groups').select('exercise_id, muscle_group_id'),
  ])

  const exercisesWithMuscles = (exercisesResult.data ?? []).map(ex => ({
    ...ex,
    muscle_group_ids: (muscleLinks ?? []).filter(ml => ml.exercise_id === ex.id).map(ml => ml.muscle_group_id),
  }))

  if (error || !cycle) notFound()

  return (
    <CycleEditor
      cycle={cycle as any}
      exercises={exercisesWithMuscles as any}
      employees={employeesResult.data ?? []}
      clients={clientsResult.data ?? []}
      holidays={holidays}
      bodyZones={bodyZones ?? []}
      muscleGroups={muscleGroups ?? []}
      movementPatterns={movementPatterns ?? []}
      equipment={equipment ?? []}
      objectives={objectives ?? []}
    />
  )
}
