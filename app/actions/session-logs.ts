'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type ExerciseLogInput = {
  exercise_id: string
  plan_exercise_id?: string
  sets_done?: number
  reps_done?: number
  load_kg?: number
  rpe?: number
  rir?: number
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
        rpe: exerciseLog.rpe ?? null,
        rir: exerciseLog.rir ?? null,
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
        rpe: exerciseLog.rpe ?? null,
        rir: exerciseLog.rir ?? null,
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
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: { session: authSession } } = await supabase.auth.getSession()
  const currentUserId = authSession?.user?.id ?? null

  const { data, error } = await adminSupabase
    .from('plan_sessions')
    .select(`
      id, session_date, session_time, session_label,
      training_plans!inner (
        id, type, level, client_id, assigned_employee_id,
        clients (id, first_name, last_name)
      ),
      plan_session_exercises (id),
      session_logs (id, status)
    `)
    .eq('session_date', today)
    .eq('training_plans.status', 'active')
    .order('session_time', { ascending: true, nullsFirst: false })

  if (error) return { error: error.message, sessions: [], currentUserId }

  // Fetch employee names separately (no FK declared between training_plans and profiles)
  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('id, full_name')

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]))

  // Inyectar full_name del empleado en cada sesión
  const enriched = (data ?? []).map((s: any) => {
    const plan = Array.isArray(s.training_plans) ? s.training_plans[0] : s.training_plans
    const empId = plan?.assigned_employee_id
    return {
      ...s,
      training_plans: {
        ...plan,
        profiles: empId ? { id: empId, full_name: profileMap.get(empId) ?? 'Sin asignar' } : null,
      },
    }
  })

  // Ordenar: sesiones del empleado logueado primero, resto por empleado
  const sessions = enriched.sort((a: any, b: any) => {
    const aIsMe = a.training_plans?.assigned_employee_id === currentUserId
    const bIsMe = b.training_plans?.assigned_employee_id === currentUserId
    if (aIsMe && !bIsMe) return -1
    if (!aIsMe && bIsMe) return 1
    // Mismo grupo: ordenar por hora
    const aTime = a.session_time ?? '99:99'
    const bTime = b.session_time ?? '99:99'
    return aTime.localeCompare(bTime)
  })

  return { sessions, currentUserId }
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
          id, plan_exercise_id, sets_done, reps_done, load_kg, rpe, rir, notes, skipped
        )
      )
    `)
    .eq('id', planSessionId)
    .single()

  if (error) return { error: error.message, session: null }
  return { session: data }
}
