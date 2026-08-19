'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type GroupSessionExercise = {
  exercise_id: string
  sets: number
  reps: number
  weight_kg?: number
  notes?: string
  order_index: number
}

export type GroupSessionData = {
  label: 'A' | 'B' | 'C'
  notes?: string
  exercises: GroupSessionExercise[]
}

export type CreateGroupCycleData = {
  start_date: string
  notes?: string
  sessions: GroupSessionData[]
}

export type CreateGroupPlanData = {
  client_id: string
  level: number
  duration_months: number
  weekly_frequency: number
  session_duration: 30 | 60
  start_date: string
  cycle_id: string
  training_dates: { date: string; session_label: 'A' | 'B' | 'C' }[]
}

// The session rotation: training day index mod 3 → A, B, C
export function getSessionLabel(trainingDayIndex: number): 'A' | 'B' | 'C' {
  return (['A', 'B', 'C'] as const)[trainingDayIndex % 3]
}

export async function createGroupCycleAction(data: CreateGroupCycleData) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  const { data: cycle, error: cycleError } = await adminSupabase
    .from('group_cycles')
    .insert({
      start_date: data.start_date,
      notes: data.notes || null,
      created_by: session.user.id,
    })
    .select()
    .single()

  if (cycleError) return { error: 'Error al crear el ciclo: ' + cycleError.message }

  for (const sessionData of data.sessions) {
    const { data: gs, error: gsError } = await adminSupabase
      .from('group_sessions')
      .insert({
        cycle_id: cycle.id,
        label: sessionData.label,
        notes: sessionData.notes || null,
      })
      .select()
      .single()

    if (gsError) continue

    if (sessionData.exercises.length > 0) {
      await adminSupabase.from('group_session_exercises').insert(
        sessionData.exercises.map(ex => ({
          session_id: gs.id,
          exercise_id: ex.exercise_id,
          sets: ex.sets,
          reps: ex.reps,
          weight_kg: ex.weight_kg ?? null,
          notes: ex.notes ?? null,
          order_index: ex.order_index,
        }))
      )
    }
  }

  return { success: true, cycle_id: cycle.id }
}

export async function createGroupPlanAction(data: CreateGroupPlanData) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  // Desactivar plan activo anterior
  await adminSupabase
    .from('training_plans')
    .update({ status: 'completed' })
    .eq('client_id', data.client_id)
    .eq('status', 'active')

  const endDate = new Date(data.start_date)
  endDate.setMonth(endDate.getMonth() + data.duration_months)

  const { data: plan, error: planError } = await adminSupabase
    .from('training_plans')
    .insert({
      client_id: data.client_id,
      type: 'group',
      cycle_id: data.cycle_id,
      level: data.level,
      status: 'active',
      duration_months: data.duration_months,
      weekly_frequency: data.weekly_frequency,
      session_duration: data.session_duration,
      start_date: data.start_date,
      end_date: endDate.toISOString().split('T')[0],
      created_by: session.user.id,
    })
    .select()
    .single()

  if (planError) return { error: 'Error al crear el plan: ' + planError.message }

  for (let i = 0; i < data.training_dates.length; i++) {
    const { date, session_label } = data.training_dates[i]
    await adminSupabase.from('plan_sessions').insert({
      plan_id: plan.id,
      session_date: date,
      session_label,
      order_index: i,
    })
  }

  return { success: true, plan_id: plan.id }
}

export async function getGroupCyclesAction() {
  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('group_cycles')
    .select(`
      id, start_date, notes, created_at,
      group_sessions(id, label, notes,
        group_session_exercises(id, exercise_id, sets, reps, weight_kg, notes, order_index)
      )
    `)
    .order('start_date', { ascending: false })

  if (error) return { error: error.message, cycles: [] }
  return { cycles: data ?? [] }
}

export async function getActiveCycleAction() {
  const adminSupabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]
  // Active cycle: started ≤ today, started > 14 days ago
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const cutoff = twoWeeksAgo.toISOString().split('T')[0]

  const { data, error } = await adminSupabase
    .from('group_cycles')
    .select(`
      id, start_date, notes,
      group_sessions(id, label, notes,
        group_session_exercises(id, exercise_id, sets, reps, weight_kg, notes, order_index,
          exercises(id, name)
        )
      )
    `)
    .gte('start_date', cutoff)
    .lte('start_date', today)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { cycle: null }
  return { cycle: data }
}
