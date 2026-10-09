'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { CYCLE_PATTERN_20, NEXT_BLOCK, DAY_SLOT_TEMPLATE, getTodayDayIndex } from '@/lib/cycle-utils'
import { generateCycleDates } from '@/lib/calendar-utils'
import { getActiveHolidayDatesAction } from './holidays'

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
  template_id?: string
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

  // Load template pattern and slots (from DB if template_id given, else hardcoded fallback)
  let cyclePattern: ('A' | 'B' | 'C')[] = CYCLE_PATTERN_20
  type SlotDef = { time: string; hasOverlap: boolean; maxClients: number }
  let slotsByDow: Record<number, SlotDef[]> = Object.fromEntries(
    [0,1,2,3,4].map(dow => [dow, DAY_SLOT_TEMPLATE[dow].map(s => ({ time: s.time, hasOverlap: s.hasOverlap, maxClients: 6 }))])
  )

  if (data.template_id) {
    const { data: tmpl } = await adminSupabase
      .from('cycle_templates')
      .select('cycle_template_days(day_index, block_label), cycle_template_slots(day_of_week, session_time, has_overlap, max_clients)')
      .eq('id', data.template_id)
      .single()

    if (tmpl) {
      const sortedDays = [...(tmpl.cycle_template_days as any[])].sort((a, b) => a.day_index - b.day_index)
      if (sortedDays.length === 20) {
        cyclePattern = sortedDays.map(d => d.block_label as 'A' | 'B' | 'C')
      }
      const slotsByDowRaw: Record<number, SlotDef[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] }
      for (const s of (tmpl.cycle_template_slots as any[])) {
        slotsByDowRaw[s.day_of_week as number]?.push({
          time: s.session_time,
          hasOverlap: s.has_overlap,
          maxClients: s.max_clients,
        })
      }
      slotsByDow = slotsByDowRaw
    }
  }

  // Get active holidays to skip them during date generation
  const startYear  = parseInt(data.start_date.slice(0, 4))
  const endYear    = startYear + 1
  const [holidaySetA, holidaySetB] = await Promise.all([
    getActiveHolidayDatesAction(startYear),
    getActiveHolidayDatesAction(endYear),
  ])
  const holidaySet = new Set([...holidaySetA, ...holidaySetB])

  // Generate the actual calendar dates for the 20 working days,
  // respecting the start_date (which may be mid-week) and skipping holidays
  const workingDayDates = generateCycleDates(data.start_date, 20, holidaySet)

  const sessionsToInsert: object[] = []

  for (let day_index = 0; day_index < 20; day_index++) {
    const sessionDate  = workingDayDates[day_index]
    if (!sessionDate) continue

    const primaryBlock = cyclePattern[day_index]
    const nextBlock    = NEXT_BLOCK[primaryBlock]
    const dow          = new Date(sessionDate + 'T12:00:00').getDay() - 1  // 0=Mon … 4=Fri
    const dowKey       = dow >= 0 && dow <= 4 ? dow : 4

    for (const { time, hasOverlap, maxClients } of (slotsByDow[dowKey] ?? [])) {
      sessionsToInsert.push({
        type: 'group', session_date: sessionDate, session_time: time,
        session_label: primaryBlock, cycle_id: cycle.id,
        day_index, max_clients: maxClients, status: 'scheduled',
      })
      if (hasOverlap) {
        sessionsToInsert.push({
          type: 'group', session_date: sessionDate, session_time: time,
          session_label: nextBlock, cycle_id: cycle.id,
          day_index, max_clients: maxClients, status: 'scheduled',
        })
      }
    }
  }

  await adminSupabase.from('training_sessions').insert(sessionsToInsert)

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
      training_sessions(
        id, day_index, session_time, session_label, max_clients, assigned_employee_id, session_date,
        training_session_clients(client_id, difficulty, clients(id, first_name, last_name))
      )
    `)
    .eq('id', id)
    .single()

  if (error) return { error: error.message, cycle: null }

  // Reshape to match component expectations (block_label → session_label)
  const cycle = {
    ...data,
    group_cycle_slots: (data?.training_sessions ?? []).map((ts: any) => ({
      id:                      ts.id,
      day_index:               ts.day_index,
      session_time:            ts.session_time,
      block_label:             ts.session_label,
      max_clients:             ts.max_clients,
      assigned_employee_id:    ts.assigned_employee_id,
      group_cycle_slot_clients: (ts.training_session_clients ?? []).map((tsc: any) => ({
        client_id: tsc.client_id,
        clients:   tsc.clients,
      })),
    })),
  }

  return { cycle }
}

export async function updateSlotAssignmentAction(
  slotId: string,
  employeeId: string | null,
  clientIds: string[],
  difficulties?: Record<string, 'regression' | 'base' | 'progression'>
) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  const { error: sessionError } = await adminSupabase
    .from('training_sessions')
    .update({ assigned_employee_id: employeeId })
    .eq('id', slotId)

  if (sessionError) return { error: sessionError.message }

  await adminSupabase.from('training_session_clients').delete().eq('session_id', slotId)

  if (clientIds.length > 0) {
    const { error: clientError } = await adminSupabase
      .from('training_session_clients')
      .insert(clientIds.map(cid => ({
        session_id: slotId,
        client_id:  cid,
        difficulty: difficulties?.[cid] ?? 'base',
      })))
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

  const todayStr = new Date().toISOString().split('T')[0]

  const { data: sessions } = await adminSupabase
    .from('training_sessions')
    .select(`
      id, session_time, session_label, max_clients, cycle_id, assigned_employee_id,
      training_session_clients(client_id, difficulty, clients(id, first_name, last_name))
    `)
    .eq('type', 'group')
    .eq('session_date', todayStr)
    .order('session_time', { ascending: true })

  if (!sessions?.length) return { slots: [] }

  const { data: profiles } = await adminSupabase.from('profiles').select('id, full_name')
  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]))

  return {
    slots: sessions.map(s => ({
      ...s,
      block_label:   s.session_label,
      employee_name: s.assigned_employee_id ? (profileMap.get(s.assigned_employee_id) ?? null) : null,
      clients:       (s.training_session_clients ?? []).map((tsc: any) => tsc.clients),
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
