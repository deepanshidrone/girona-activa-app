'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type PlanExercise = {
  exercise_id: string
  sets: number
  reps: number
  weight_kg?: number
  notes?: string
  order_index: number
}

export type PlanDay = {
  date: string // YYYY-MM-DD
  exercises: PlanExercise[]
}

export type CreatePlanData = {
  client_id: string
  level: number
  duration_months: number
  weekly_frequency: number
  session_duration: 30 | 60
  start_date: string
  days: PlanDay[]
}

export async function createPlanAction(data: CreatePlanData) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  // 1. Desactivar plan activo anterior del cliente
  await adminSupabase
    .from('training_plans')
    .update({ status: 'completed' })
    .eq('client_id', data.client_id)
    .eq('status', 'active')

  // 2. Crear el plan
  const endDate = new Date(data.start_date)
  endDate.setMonth(endDate.getMonth() + data.duration_months)

  const { data: plan, error: planError } = await adminSupabase
    .from('training_plans')
    .insert({
      client_id: data.client_id,
      type: 'individual',
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

  // 3. Crear las sesiones con sus ejercicios
  for (let i = 0; i < data.days.length; i++) {
    const day = data.days[i]

    const { data: session_data, error: sessionError } = await adminSupabase
      .from('plan_sessions')
      .insert({
        plan_id: plan.id,
        session_date: day.date,
        order_index: i,
      })
      .select()
      .single()

    if (sessionError) continue

    if (day.exercises.length > 0) {
      await adminSupabase.from('plan_session_exercises').insert(
        day.exercises.map(ex => ({
          session_id: session_data.id,
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

  return { success: true, plan_id: plan.id }
}
