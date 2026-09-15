'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type ExerciseLogInput = {
  exercise_id: string
  plan_exercise_id?: string
  sets_done?: number
  reps_done?: number
  load_kg?: number
  effort?: number
  notes?: string
  skipped?: boolean
}

export async function startSessionLogAction(planSessionId: string, clientId: string) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  // Si ya existe un log para esta sesión, devuelve el existente
  const { data: existing } = await adminSupabase
    .from('session_logs')
    .select('id, status')
    .eq('plan_session_id', planSessionId)
    .single()

  if (existing) return { session_log_id: existing.id, status: existing.status }

  const { data, error } = await adminSupabase
    .from('session_logs')
    .insert({
      plan_session_id: planSessionId,
      client_id: clientId,
      employee_id: session.user.id,
      date: new Date().toISOString().split('T')[0],
      status: 'in_progress',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  return { session_log_id: data.id, status: 'in_progress' }
}

export async function saveExerciseLogAction(
  sessionLogId: string,
  exerciseLog: ExerciseLogInput
) {
  const adminSupabase = createAdminClient()

  // Upsert por session_log_id + plan_exercise_id
  const { data: existing } = await adminSupabase
    .from('exercise_logs')
    .select('id')
    .eq('session_log_id', sessionLogId)
    .eq('plan_exercise_id', exerciseLog.plan_exercise_id ?? '')
    .single()

  if (existing) {
    const { error } = await adminSupabase
      .from('exercise_logs')
      .update({
        sets_done: exerciseLog.sets_done ?? null,
        reps_done: exerciseLog.reps_done ?? null,
        load_kg: exerciseLog.load_kg ?? null,
        effort: exerciseLog.effort ?? null,
        notes: exerciseLog.notes ?? null,
        skipped: exerciseLog.skipped ?? false,
      })
      .eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    const { error } = await adminSupabase
      .from('exercise_logs')
      .insert({
        session_log_id: sessionLogId,
        exercise_id: exerciseLog.exercise_id,
        plan_exercise_id: exerciseLog.plan_exercise_id ?? null,
        sets_done: exerciseLog.sets_done ?? null,
        reps_done: exerciseLog.reps_done ?? null,
        load_kg: exerciseLog.load_kg ?? null,
        effort: exerciseLog.effort ?? null,
        notes: exerciseLog.notes ?? null,
        skipped: exerciseLog.skipped ?? false,
      })
    if (error) return { error: error.message }
  }

  return { success: true }
}

export async function completeSessionLogAction(sessionLogId: string) {
  const adminSupabase = createAdminClient()

  const { error } = await adminSupabase
    .from('session_logs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', sessionLogId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getTodaySessionsAction() {
  const adminSupabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await adminSupabase
    .from('plan_sessions')
    .select(`
      id, session_date, session_time, session_label, order_index,
      training_plans!inner (
        id, type, level, client_id,
        clients (id, first_name, last_name)
      ),
      plan_session_exercises (id),
      session_logs (id, status)
    `)
    .eq('session_date', today)
    .eq('training_plans.status', 'active')
    .order('session_time', { ascending: true, nullsFirst: false })

  if (error) return { error: error.message, sessions: [] }
  return { sessions: data ?? [] }
}

export async function getSessionDetailAction(planSessionId: string) {
  const adminSupabase = createAdminClient()

  const { data, error } = await adminSupabase
    .from('plan_sessions')
    .select(`
      id, session_date, session_time,
      training_plans (
        id, type, level, client_id,
        clients (id, first_name, last_name)
      ),
      plan_session_exercises (
        id, sets, reps, weight_kg, notes, order_index,
        exercises (id, name, technical_name)
      ),
      session_logs (
        id, status, notes,
        exercise_logs (
          id, plan_exercise_id, sets_done, reps_done, load_kg, effort, notes, skipped
        )
      )
    `)
    .eq('id', planSessionId)
    .single()

  if (error) return { error: error.message, session: null }
  return { session: data }
}
