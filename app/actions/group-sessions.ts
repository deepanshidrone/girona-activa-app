'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { CYCLE_PATTERN_20, NEXT_BLOCK, DAY_SLOT_TEMPLATE, getTodayDayIndex } from '@/lib/cycle-utils'

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
  assigned_employee_id: string
  level: number
  duration_months: number
  weekly_frequency: number
  session_duration: 30 | 60
  start_date: string
  cycle_id: string
  session_time?: string
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

  // Auto-generate slots for all 20 working days based on predefined template
  const slotsToInsert: {
    cycle_id: string; day_index: number; session_time: string
    block_label: string; max_clients: number
  }[] = []

  for (let day_index = 0; day_index < 20; day_index++) {
    const primaryBlock = CYCLE_PATTERN_20[day_index]
    const nextBlock    = NEXT_BLOCK[primaryBlock]
    const dayOfWeek    = day_index % 5
    for (const { time, hasOverlap } of DAY_SLOT_TEMPLATE[dayOfWeek]) {
      slotsToInsert.push({ cycle_id: cycle.id, day_index, session_time: time, block_label: primaryBlock, max_clients: 6 })
      if (hasOverlap) {
        slotsToInsert.push({ cycle_id: cycle.id, day_index, session_time: time, block_label: nextBlock, max_clients: 6 })
      }
    }
  }

  await adminSupabase.from('group_cycle_slots').insert(slotsToInsert)

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
      assigned_employee_id: data.assigned_employee_id,
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
      session_time: data.session_time ?? null,
      session_label,
      order_index: i,
    })
  }

  return { success: true, plan_id: plan.id }
}

export async function getGroupCycleByIdAction(id: string) {
  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('group_cycles')
    .select(`
      id, start_date, notes,
      group_sessions(id, label, difficulty, notes,
        group_session_exercises(id, exercise_id, sets, reps, weight_kg, notes, order_index,
          exercises(id, name, technical_name)
        )
      ),
      group_cycle_slots(
        id, day_index, session_time, block_label, max_clients, assigned_employee_id,
        group_cycle_slot_clients(client_id, clients(id, first_name, last_name))
      )
    `)
    .eq('id', id)
    .single()

  if (error) return { error: error.message, cycle: null }
  return { cycle: data }
}

export async function updateSlotAssignmentAction(
  slotId: string,
  employeeId: string | null,
  clientIds: string[]
) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  const { error: slotError } = await adminSupabase
    .from('group_cycle_slots')
    .update({ assigned_employee_id: employeeId })
    .eq('id', slotId)

  if (slotError) return { error: slotError.message }

  await adminSupabase.from('group_cycle_slot_clients').delete().eq('slot_id', slotId)

  if (clientIds.length > 0) {
    const { error: clientError } = await adminSupabase
      .from('group_cycle_slot_clients')
      .insert(clientIds.map(cid => ({ slot_id: slotId, client_id: cid })))
    if (clientError) return { error: clientError.message }
  }

  return { success: true }
}

export async function updateGroupSessionExerciseAction(
  gseId: string,
  data: { sets?: number; reps?: number; weight_kg?: number | null; notes?: string | null }
) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  const { error } = await adminSupabase
    .from('group_session_exercises')
    .update(data)
    .eq('id', gseId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function addGroupSessionExerciseAction(
  sessionId: string,
  exerciseId: string,
  data: { sets: number; reps: number; weight_kg?: number | null; order_index: number }
) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  const { data: row, error } = await adminSupabase
    .from('group_session_exercises')
    .insert({
      session_id: sessionId,
      exercise_id: exerciseId,
      sets: data.sets,
      reps: data.reps,
      weight_kg: data.weight_kg ?? null,
      order_index: data.order_index,
    })
    .select('id, exercise_id, sets, reps, weight_kg, notes, order_index, exercises(id, name, technical_name)')
    .single()

  if (error) return { error: error.message }
  return { success: true, row }
}

export async function deleteGroupSessionExerciseAction(gseId: string) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  const { error } = await adminSupabase
    .from('group_session_exercises')
    .delete()
    .eq('id', gseId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function swapGroupSessionExerciseAction(gseId: string, newExerciseId: string) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  const { error } = await adminSupabase
    .from('group_session_exercises')
    .update({ exercise_id: newExerciseId })
    .eq('id', gseId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getTodayGroupSlotsAction() {
  const adminSupabase = createAdminClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 4-week cycle: last working day is start + 25 calendar days (week 4 Fri)
  const earliestStart = new Date(today)
  earliestStart.setDate(today.getDate() - 25)

  const { data: cycles } = await adminSupabase
    .from('group_cycles')
    .select('id, start_date')
    .gte('start_date', earliestStart.toISOString().split('T')[0])
    .lte('start_date', today.toISOString().split('T')[0])

  if (!cycles?.length) return { slots: [] }

  const targets: { cycle_id: string; day_index: number }[] = []
  for (const cycle of cycles) {
    const day_index = getTodayDayIndex(cycle.start_date)
    if (day_index !== null) targets.push({ cycle_id: cycle.id, day_index })
  }

  if (!targets.length) return { slots: [] }

  const allSlots: any[] = []
  for (const { cycle_id, day_index } of targets) {
    const { data: slots } = await adminSupabase
      .from('group_cycle_slots')
      .select(`
        id, day_index, session_time, block_label, max_clients, cycle_id,
        assigned_employee_id,
        group_cycle_slot_clients(client_id, clients(id, first_name, last_name))
      `)
      .eq('cycle_id', cycle_id)
      .eq('day_index', day_index)
      .order('session_time', { ascending: true })

    if (slots) allSlots.push(...slots)
  }

  const { data: profiles } = await adminSupabase.from('profiles').select('id, full_name')
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]))

  return {
    slots: allSlots.map(slot => ({
      ...slot,
      employee_name: slot.assigned_employee_id
        ? (profileMap.get(slot.assigned_employee_id) ?? null)
        : null,
      clients: (slot.group_cycle_slot_clients ?? []).map((sc: any) => sc.clients),
    })),
  }
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
