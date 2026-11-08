'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/auth/permissions'
import { getCenterToday } from '@/lib/center-settings'
import { addDays } from '@/lib/center'

// Registro de sesiones grupales (ciclos) por el personal.
// Paso 1, obligatorio: pasar lista. Cada cliente apuntado queda con un
// session_logs 'completed' (vino) o 'absent' (no vino).
// Paso 2, opcional: el detalle de los ejercicios de cada asistente
// (exercise_logs sobre su session_log, con los ejercicios de su dificultad).

type Difficulty = 'regression' | 'base' | 'progression'

export type GroupExercise = {
  gse_id: string
  exercise_id: string
  name: string
  sets: number | null
  reps: number | null
  weight_kg: number | null
  notes: string | null
  order_index: number | null
}

export type GroupExerciseLog = {
  id: string
  exercise_id: string | null
  sets_done: number | null
  reps_done: number | null
  load_kg: number | null
  rpe: number | null
  rir: number | null
  notes: string | null
  skipped: boolean | null
}

export type GroupClientRow = {
  client_id: string
  name: string
  difficulty: Difficulty
  log: { id: string; status: 'in_progress' | 'completed' | 'absent'; exercise_logs: GroupExerciseLog[] } | null
}

export type GroupSessionForLog = {
  id: string
  session_date: string
  session_time: string | null
  duration_min: number | null
  session_label: string | null
  status: string
  cycle_id: string | null
  employee_name: string | null
  clients: GroupClientRow[]
  exercises: Record<Difficulty, GroupExercise[]>
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null)

export async function getGroupSessionForLogAction(trainingSessionId: string): Promise<GroupSessionForLog | null> {
  const auth = await requireStaff()
  if (!auth.user) return null
  const admin = createAdminClient()

  const { data: ts } = await admin
    .from('training_sessions')
    .select(`id, type, session_date, session_time, duration_min, session_label, status, cycle_id, assigned_employee_id,
      training_session_clients(client_id, difficulty, clients(first_name, last_name))`)
    .eq('id', trainingSessionId)
    .eq('type', 'group')
    .maybeSingle()
  if (!ts) return null

  const [{ data: logs }, { data: emp }, { data: blocks }] = await Promise.all([
    admin.from('session_logs')
      .select('id, client_id, status, exercise_logs(id, exercise_id, sets_done, reps_done, load_kg, rpe, rir, notes, skipped)')
      .eq('training_session_id', ts.id),
    ts.assigned_employee_id
      ? admin.from('profiles').select('full_name').eq('id', ts.assigned_employee_id).maybeSingle()
      : Promise.resolve({ data: null }),
    ts.cycle_id && ts.session_label
      ? admin.from('group_sessions')
          .select('difficulty, group_session_exercises(id, exercise_id, sets, reps, weight_kg, notes, order_index, exercises(name))')
          .eq('cycle_id', ts.cycle_id).eq('label', ts.session_label)
      : Promise.resolve({ data: [] }),
  ])

  const exercises: Record<Difficulty, GroupExercise[]> = { regression: [], base: [], progression: [] }
  for (const b of (blocks ?? []) as { difficulty: Difficulty; group_session_exercises: unknown[] }[]) {
    exercises[b.difficulty] = (b.group_session_exercises as {
      id: string; exercise_id: string; sets: number | null; reps: number | null; weight_kg: number | null
      notes: string | null; order_index: number | null; exercises: { name: string } | { name: string }[] | null
    }[]).map(g => ({
      gse_id: g.id, exercise_id: g.exercise_id, name: one(g.exercises)?.name ?? 'Ejercicio',
      sets: g.sets, reps: g.reps, weight_kg: g.weight_kg, notes: g.notes, order_index: g.order_index,
    })).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
  }

  const logByClient = new Map((logs ?? []).map(l => [l.client_id as string, l]))
  const clients: GroupClientRow[] = ((ts.training_session_clients ?? []) as {
    client_id: string; difficulty: Difficulty | null
    clients: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  }[]).map(tsc => {
    const c = one(tsc.clients)
    const l = logByClient.get(tsc.client_id)
    return {
      client_id: tsc.client_id,
      name: c ? `${c.first_name} ${c.last_name}` : 'Cliente',
      difficulty: tsc.difficulty ?? 'base',
      log: l ? { id: l.id, status: l.status, exercise_logs: (l.exercise_logs ?? []) as GroupExerciseLog[] } : null,
    }
  }).sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return {
    id: ts.id, session_date: ts.session_date, session_time: ts.session_time, duration_min: ts.duration_min,
    session_label: ts.session_label, status: ts.status, cycle_id: ts.cycle_id,
    employee_name: (emp as { full_name: string | null } | null)?.full_name ?? null,
    clients, exercises,
  }
}

// Pasa lista: attendance = { client_id: true (vino) | false (no vino) } para
// TODOS los apuntados. Marcar como "no vino" a quien tenía detalle lo borra.
export async function saveGroupAttendanceAction(
  trainingSessionId: string, attendance: Record<string, boolean>,
): Promise<{ ok: true; present: number; total: number } | { ok: false; error: string }> {
  const auth = await requireStaff()
  if (!auth.user) return { ok: false, error: auth.error }
  const admin = createAdminClient()

  const { data: ts } = await admin.from('training_sessions')
    .select('id, session_date, status, training_session_clients(client_id)')
    .eq('id', trainingSessionId).eq('type', 'group').maybeSingle()
  if (!ts) return { ok: false, error: 'Sesión no encontrada' }
  if (ts.status === 'cancelled') return { ok: false, error: 'La sesión está cancelada.' }

  const today = await getCenterToday(admin)
  if (ts.session_date > today) return { ok: false, error: 'Todavía no se puede pasar lista de una sesión futura.' }

  const clientIds = (ts.training_session_clients ?? []).map((c: { client_id: string }) => c.client_id)
  if (clientIds.length === 0) return { ok: false, error: 'La sesión no tiene clientes apuntados.' }
  if (clientIds.some(id => typeof attendance?.[id] !== 'boolean')) {
    return { ok: false, error: 'Marca si ha venido cada cliente.' }
  }

  const { data: existing } = await admin.from('session_logs')
    .select('id, client_id, status, completed_at').eq('training_session_id', ts.id)
  const byClient = new Map((existing ?? []).map(l => [l.client_id, l]))
  const now = new Date().toISOString()

  for (const clientId of clientIds) {
    const present = attendance[clientId]
    const log = byClient.get(clientId)
    const status = present ? 'completed' : 'absent'
    if (log) {
      if (!present) {
        const { error } = await admin.from('exercise_logs').delete().eq('session_log_id', log.id)
        if (error) return { ok: false, error: 'No se ha podido guardar la asistencia.' }
      }
      if (log.status !== status) {
        const { error } = await admin.from('session_logs').update({
          status, employee_id: auth.user.id,
          completed_at: present ? (log.completed_at ?? now) : null,
        }).eq('id', log.id)
        if (error) return { ok: false, error: 'No se ha podido guardar la asistencia.' }
      }
    } else {
      const { error } = await admin.from('session_logs').insert({
        training_session_id: ts.id, client_id: clientId, employee_id: auth.user.id,
        date: ts.session_date, status, started_at: present ? now : null, completed_at: present ? now : null,
      })
      if (error) return { ok: false, error: 'No se ha podido guardar la asistencia.' }
    }
  }

  // Clientes que ya no están apuntados pero tenían registro: se quitan
  const stale = (existing ?? []).filter(l => !clientIds.includes(l.client_id)).map(l => l.id)
  if (stale.length) await admin.from('session_logs').delete().in('id', stale)

  const presentCount = clientIds.filter(id => attendance[id]).length
  return { ok: true, present: presentCount, total: clientIds.length }
}

export type GroupExerciseLogInput = {
  exercise_id: string
  sets_done?: number | null
  reps_done?: number | null
  load_kg?: number | null
  rpe?: number | null
  rir?: number | null
  notes?: string | null
  skipped?: boolean
}

const intIn = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null

// Detalle opcional de un ejercicio de un asistente (uno por ejercicio y registro).
export async function saveGroupExerciseLogAction(
  sessionLogId: string, input: GroupExerciseLogInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireStaff()
  if (!auth.user) return { ok: false, error: auth.error }
  const admin = createAdminClient()

  const { data: log } = await admin.from('session_logs')
    .select('id, status, training_session_id').eq('id', sessionLogId).maybeSingle()
  if (!log?.training_session_id) return { ok: false, error: 'Registro no encontrado' }
  if (log.status !== 'completed') return { ok: false, error: 'Marca primero que el cliente ha venido.' }
  if (typeof input?.exercise_id !== 'string') return { ok: false, error: 'Ejercicio no válido' }

  const skipped = !!input.skipped
  const load = typeof input.load_kg === 'number' && input.load_kg >= 0 && input.load_kg <= 1000 ? input.load_kg : null
  const row = {
    session_log_id: log.id,
    exercise_id: input.exercise_id,
    plan_exercise_id: null,
    sets_done: skipped ? null : intIn(input.sets_done, 0, 100),
    reps_done: skipped ? null : intIn(input.reps_done, 0, 1000),
    load_kg: skipped ? null : load,
    rpe: skipped ? null : intIn(input.rpe, 1, 10),
    rir: skipped ? null : intIn(input.rir, 0, 10),
    notes: input.notes?.trim() ? input.notes.trim().slice(0, 1000) : null,
    skipped,
  }

  const { data: existing } = await admin.from('exercise_logs').select('id')
    .eq('session_log_id', log.id).eq('exercise_id', input.exercise_id).maybeSingle()
  const { error } = existing
    ? await admin.from('exercise_logs').update(row).eq('id', existing.id)
    : await admin.from('exercise_logs').insert(row)
  if (error) return { ok: false, error: 'No se ha podido guardar el ejercicio.' }
  return { ok: true }
}

export type UnrecordedGroupSession = {
  id: string; session_date: string; session_time: string | null; session_label: string | null
  employee_name: string | null; clients: number
}

// Clases grupales de los últimos `days` días (sin hoy) con clientes apuntados y
// sin pasar lista: para recordarlo en la agenda "Hoy".
export async function getUnrecordedGroupSessionsAction(days = 7): Promise<UnrecordedGroupSession[]> {
  const auth = await requireStaff()
  if (!auth.user) return []
  const admin = createAdminClient()
  const today = await getCenterToday(admin)

  const { data } = await admin.from('training_sessions')
    .select('id, session_date, session_time, session_label, assigned_employee_id, training_session_clients(client_id), session_logs(id)')
    .eq('type', 'group').neq('status', 'cancelled')
    .gte('session_date', addDays(today, -days)).lt('session_date', today)
    .order('session_date', { ascending: false }).order('session_time')
  const pending = (data ?? []).filter(s =>
    (s.training_session_clients ?? []).length > 0 && (s.session_logs ?? []).length === 0)
  if (pending.length === 0) return []

  const empIds = [...new Set(pending.map(s => s.assigned_employee_id).filter(Boolean))] as string[]
  const { data: profiles } = empIds.length
    ? await admin.from('profiles').select('id, full_name').in('id', empIds)
    : { data: [] as { id: string; full_name: string | null }[] }
  const names = new Map((profiles ?? []).map(p => [p.id, p.full_name]))

  return pending.map(s => ({
    id: s.id, session_date: s.session_date, session_time: s.session_time, session_label: s.session_label,
    employee_name: s.assigned_employee_id ? names.get(s.assigned_employee_id) ?? null : null,
    clients: (s.training_session_clients ?? []).length,
  }))
}
