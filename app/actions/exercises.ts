'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type CreateExerciseData = {
  name: string
  movement_pattern_id?: string
  level?: number
  technical_level?: string
  equipment_id?: string
  objective_id?: string
  muscle_group_ids?: string[]
  progression?: string
  regression?: string
}

export async function createExerciseAction(data: CreateExerciseData) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  const { data: exercise, error } = await adminSupabase
    .from('exercises')
    .insert({
      name: data.name,
      movement_pattern_id: data.movement_pattern_id || null,
      level: data.level || null,
      technical_level: data.technical_level || null,
      equipment_id: data.equipment_id || null,
      objective_id: data.objective_id || null,
      progression: data.progression || null,
      regression: data.regression || null,
    })
    .select()
    .single()

  if (error) return { error: 'Error al crear el ejercicio: ' + error.message }

  // Insertar grupos musculares
  if (data.muscle_group_ids && data.muscle_group_ids.length > 0) {
    await adminSupabase.from('exercise_muscle_groups').insert(
      data.muscle_group_ids.map(id => ({
        exercise_id: exercise.id,
        muscle_group_id: id,
      }))
    )
  }

  return { success: true, id: exercise.id }
}

export async function createCatalogItemAction(table: 'movement_patterns' | 'equipment' | 'objectives', name: string) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  const { data, error } = await adminSupabase
    .from(table)
    .insert({ name })
    .select()
    .single()

  if (error) return { error: error.message }
  return { success: true, item: data }
}
