'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function verifyEmployee() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null
  if (session.user.app_metadata?.role !== 'employee') return null
  return session.user
}

export async function moveSessionAction(sessionId: string, newDate: string) {
  if (!await verifyEmployee()) return { error: 'No autorizado' }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('plan_sessions')
    .update({ session_date: newDate })
    .eq('id', sessionId)
  if (error) return { error: error.message }
  return { success: true }
}

export async function updateSessionExerciseAction(
  id: string,
  sets: number,
  reps: number,
  weight_kg: number | null,
  notes: string | null
) {
  if (!await verifyEmployee()) return { error: 'No autorizado' }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('plan_session_exercises')
    .update({ sets, reps, weight_kg, notes })
    .eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteSessionExerciseAction(id: string) {
  if (!await verifyEmployee()) return { error: 'No autorizado' }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('plan_session_exercises')
    .delete()
    .eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function addSessionExerciseAction(
  sessionId: string,
  exerciseId: string,
  sets: number,
  reps: number,
  weight_kg: number | null,
  notes: string | null,
  orderIndex: number
) {
  if (!await verifyEmployee()) return { error: 'No autorizado' }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('plan_session_exercises')
    .insert({ session_id: sessionId, exercise_id: exerciseId, sets, reps, weight_kg, notes, order_index: orderIndex })
  if (error) return { error: error.message }
  return { success: true }
}
