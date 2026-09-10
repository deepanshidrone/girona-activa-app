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

export type { Difficulty } from '@/lib/group-sessions-utils'

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
    // 1. Crear sesión base
    const { data: baseSession, error: baseError } = await adminSupabase
      .from('group_sessions')
      .insert({
        cycle_id: cycle.id,
        label: sessionData.label,
        difficulty: 'base',
        notes: sessionData.notes || null,
      })
      .select()
      .single()

    if (baseError) continue

    if (sessionData.exercises.length === 0) {
      // Auto-generar sesiones vacías igualmente
      await adminSupabase.from('group_sessions').insert([
        { cycle_id: cycle.id, label: sessionData.label, difficulty: 'regression' },
        { cycle_id: cycle.id, label: sessionData.label, difficulty: 'progression' },
      ])
      continue
    }

    // 2. Obtener progression_id / regression_id de cada ejercicio base
    const exerciseIds = sessionData.exercises.map(e => e.exercise_id)
    const { data: exerciseDetails } = await adminSupabase
      .from('exercises')
      .select('id, regression_id, progression_id')
      .in('id', exerciseIds)

    const detailMap = new Map((exerciseDetails ?? []).map(e => [e.id, e]))

    type EnrichedEx = GroupSessionExercise & { regression_id: string | null; progression_id: string | null }
    const enriched: EnrichedEx[] = sessionData.exercises.map(ex => ({
      ...ex,
      weight_kg: ex.weight_kg ?? undefined,
      notes: ex.notes ?? undefined,
      regression_id: detailMap.get(ex.exercise_id)?.regression_id ?? null,
      progression_id: detailMap.get(ex.exercise_id)?.progression_id ?? null,
    }))

    // 3. Insertar ejercicios de la sesión base
    await adminSupabase.from('group_session_exercises').insert(
      enriched.map(ex => ({
        session_id: baseSession.id,
        exercise_id: ex.exercise_id,
        sets: ex.sets,
        reps: ex.reps,
        weight_kg: ex.weight_kg ?? null,
        notes: ex.notes ?? null,
        order_index: ex.order_index,
      }))
    )

    // 4. Auto-generar sesión regresión
    const { data: regSession } = await adminSupabase
      .from('group_sessions')
      .insert({
        cycle_id: cycle.id,
        label: sessionData.label,
        difficulty: 'regression',
        notes: `Auto-generada a partir de sesión ${sessionData.label}`,
      })
      .select()
      .single()

    if (regSession) {
      await adminSupabase.from('group_session_exercises').insert(
        enriched.map(ex => ({
          session_id: regSession.id,
          exercise_id: ex.regression_id ?? ex.exercise_id, // fallback al ejercicio base
          sets: ex.sets,
          reps: ex.reps,
          weight_kg: ex.weight_kg ?? null,
          notes: ex.notes ?? null,
          order_index: ex.order_index,
        }))
      )
    }

    // 5. Auto-generar sesión progresión
    const { data: progSession } = await adminSupabase
      .from('group_sessions')
      .insert({
        cycle_id: cycle.id,
        label: sessionData.label,
        difficulty: 'progression',
        notes: `Auto-generada a partir de sesión ${sessionData.label}`,
      })
      .select()
      .single()

    if (progSession) {
      await adminSupabase.from('group_session_exercises').insert(
        enriched.map(ex => ({
          session_id: progSession.id,
          exercise_id: ex.progression_id ?? ex.exercise_id, // fallback al ejercicio base
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
      group_sessions(id, label, difficulty, notes,
        group_session_exercises(id, exercise_id, sets, reps, weight_kg, notes, order_index,
          exercises(id, name)
        )
      )
    `)
    .order('start_date', { ascending: false })

  if (error) return { error: error.message, cycles: [] }
  return { cycles: data ?? [] }
}
