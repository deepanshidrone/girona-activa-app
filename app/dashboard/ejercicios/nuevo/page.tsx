import { createClient } from '@/lib/supabase/server'
import NuevoEjercicioForm from './form'

export default async function NuevoEjercicioPage() {
  const supabase = await createClient()

  const [
    { data: movementPatterns },
    { data: muscleGroups },
    { data: equipment },
    { data: objectives },
  ] = await Promise.all([
    supabase.from('movement_patterns').select('id, name').order('name'),
    supabase.from('muscle_groups').select('id, name').order('name'),
    supabase.from('equipment').select('id, name').order('name'),
    supabase.from('objectives').select('id, name').order('name'),
  ])

  return (
    <NuevoEjercicioForm
      movementPatterns={movementPatterns ?? []}
      muscleGroups={muscleGroups ?? []}
      equipment={equipment ?? []}
      objectives={objectives ?? []}
    />
  )
}
