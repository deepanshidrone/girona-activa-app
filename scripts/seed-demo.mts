// Datos de demo del panel de indicadores (docs/spec-kpis.md §11.2).
//
// Genera 12 meses de historia del centro con escenarios conocidos. Todo lo que
// crea va marcado con is_demo (clientes, entrenadores y ciclos) y se borra con
// --reset sin tocar lo que el personal haya creado a mano.
//
// Uso (desde la carpeta brotafit, lee .env.local):
//   ALLOW_DEMO_SEED=true node scripts/seed-demo.mts           crea la demo (borra antes la anterior)
//   ALLOW_DEMO_SEED=true node scripts/seed-demo.mts --reset   solo borra la demo
// En PowerShell: $env:ALLOW_DEMO_SEED='true'; node scripts/seed-demo.mts
//
// Tras el go-live este script no debe ejecutarse nunca contra producción.

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ── Configuración ──────────────────────────────────────────────────────────
const SEED = 20261106
const N_CLIENTS = 60
const DEMO_EMAIL_DOMAIN = 'demo.brotafit.invalid'
const TIMEZONE = 'Europe/Madrid'

function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
    }
  } catch {
    // sin .env.local: se usan las variables del entorno
  }
}

// ── Utilidades ─────────────────────────────────────────────────────────────
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(SEED)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]
const chance = (p: number) => rand() < p
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1))

function todayIn(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function addMonths(date: string, months: number): string {
  const d = new Date(date + 'T00:00:00Z')
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return d.toISOString().slice(0, 10)
}
function isoDow(date: string): number {
  const d = new Date(date + 'T00:00:00Z').getUTCDay()
  return d === 0 ? 7 : d
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00Z').getTime() - new Date(a + 'T00:00:00Z').getTime()) / 86400000)
}

async function insertChunks(db: SupabaseClient, table: string, rows: object[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).insert(rows.slice(i, i + size))
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

// ── Borrado de la demo ──────────────────────────────────────────────────────
async function reset(db: SupabaseClient) {
  console.log('Borrando la demo anterior…')
  // Los clientes arrastran en cascada periodos, planes, sesiones, registros y plazas
  let r = await db.from('clients').delete().eq('is_demo', true)
  if (r.error) throw new Error('clients: ' + r.error.message)
  r = await db.from('group_cycles').delete().eq('is_demo', true)
  if (r.error) throw new Error('group_cycles: ' + r.error.message)
  r = await db.from('cycle_templates').delete().eq('is_demo', true)
  if (r.error) throw new Error('cycle_templates: ' + r.error.message)

  const { data: demoStaff } = await db.from('profiles').select('id, full_name').eq('is_demo', true)
  for (const p of demoStaff ?? []) {
    const { error } = await db.auth.admin.deleteUser(p.id)
    if (error) {
      console.warn(`  No se pudo borrar al entrenador demo ${p.full_name}: ${error.message}`)
      console.warn('  (probablemente tiene planes o registros creados a mano; reasígnalos y vuelve a ejecutar --reset)')
    }
  }
}

// ── Generación ──────────────────────────────────────────────────────────────
const FIRST = ['Ana', 'Marc', 'Laura', 'Jordi', 'Marta', 'Pau', 'Núria', 'Sergi', 'Carla', 'David', 'Elena', 'Xavi', 'Júlia', 'Albert', 'Sara', 'Oriol', 'Clara', 'Pere', 'Lucía', 'Àlex', 'Irene', 'Raúl', 'Montse', 'Joan', 'Paula', 'Víctor', 'Eva', 'Toni', 'Berta', 'Hugo']
const LAST = ['Puig', 'García', 'Serra', 'Martínez', 'Vila', 'López', 'Soler', 'Ferrer', 'Roca', 'Sánchez', 'Font', 'Pérez', 'Costa', 'Mas', 'Ruiz', 'Riera', 'Gómez', 'Bosch', 'Torres', 'Pujol']
const TRAINERS = [
  { name: 'Demo · Lucía Entrenadora', hours: 30 },   // recibe más clientes: sobrecargada (> 85 %)
  { name: 'Demo · Marc Entrenador', hours: 30 },
  { name: 'Demo · Sara Entrenadora', hours: 30 },
  { name: 'Demo · Pau Entrenador', hours: 25 },      // casi sin clientes: poca carga
]
// Peso de las altas por mes (enero y septiembre suben, agosto cae)
const MONTH_WEIGHT = [1.6, 1.1, 1.0, 1.0, 1.0, 0.9, 0.7, 0.3, 1.7, 1.2, 1.0, 0.7]
const GROUP_SLOTS = ['07:00', '09:30', '18:00', '19:30']
const SLOT_POPULARITY: Record<string, number> = { '07:00': 0.9, '09:30': 0, '18:00': 1, '19:30': 0.8 } // 09:30: franja vacía

type Profile = 'constante' | 'normal' | 'flojo' | 'apagandose'
const ADHERENCE: Record<Profile, number> = { constante: 0.95, normal: 0.8, flojo: 0.6, apagandose: 0.75 }

async function main() {
  loadEnv()
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    console.error('Bloqueado: define ALLOW_DEMO_SEED=true para escribir datos de demo en la BD.')
    process.exit(1)
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY')
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  await reset(db)
  if (process.argv.includes('--reset')) {
    console.log('Demo borrada.')
    return
  }

  const today = todayIn(TIMEZONE)
  const start = addMonths(today.slice(0, 7) + '-01', -12)
  console.log(`Generando demo del ${start} al ${today}…`)

  // Catálogos que se reutilizan
  const [{ data: exercises }, { data: holidays }, { data: reasons }] = await Promise.all([
    db.from('exercises').select('id').order('name').limit(80),
    db.from('public_holidays').select('date').eq('is_active', true),
    db.from('client_end_reasons').select('id, label, requires_notes').eq('is_active', true).order('sort_order'),
  ])
  if (!exercises?.length) throw new Error('La galería de ejercicios está vacía')
  const holidaySet = new Set((holidays ?? []).map(h => h.date))
  const reasonList = (reasons ?? []).filter(r => !r.requires_notes)
  const isWorkday = (d: string) => isoDow(d) <= 5 && !holidaySet.has(d)

  // 1. Entrenadores demo (cuentas de Auth con rol employee)
  const trainerIds: string[] = []
  for (const [i, t] of TRAINERS.entries()) {
    const { data, error } = await db.auth.admin.createUser({
      email: `entrenador${i + 1}@${DEMO_EMAIL_DOMAIN}`,
      email_confirm: true,
      app_metadata: { role: 'employee' },
      user_metadata: { full_name: t.name },
    })
    if (error || !data.user) throw new Error('Entrenador demo: ' + error?.message)
    const { error: pErr } = await db.from('profiles')
      .update({ full_name: t.name, role: 'employee', weekly_hours: t.hours, is_demo: true, is_active: true })
      .eq('id', data.user.id)
    if (pErr) throw new Error('Perfil demo: ' + pErr.message)
    trainerIds.push(data.user.id)
  }
  // El entrenador 0 recibe más clientes (sobrecarga) y el 3 muy pocos
  const trainerWeights = [0.4, 0.27, 0.27, 0.06]
  const pickTrainer = () => {
    let r = rand()
    for (let i = 0; i < trainerWeights.length; i++) { if ((r -= trainerWeights[i]) < 0) return trainerIds[i] }
    return trainerIds[0]
  }

  // 2. Ciclos grupales demo de 20 días laborables, seguidos, desde `start`
  const cycles: { id: string; start_date: string; is_demo: boolean; notes: string }[] = []
  const trainingSessions: { id: string; type: string; session_date: string; session_time: string; session_label: string; cycle_id: string; day_index: number; max_clients: number; duration_min: number; status: string; assigned_employee_id: string }[] = []
  {
    let d = start
    while (!isWorkday(d)) d = addDays(d, 1)
    const horizon = addDays(today, 30)
    while (d <= horizon) {
      const cycleId = randomUUID()
      cycles.push({ id: cycleId, start_date: d, is_demo: true, notes: 'Ciclo de demo' })
      for (let day = 0; day < 20; day++) {
        while (!isWorkday(d)) d = addDays(d, 1)
        for (const [k, time] of GROUP_SLOTS.entries()) {
          // La franja de las 9:30 solo martes y jueves (y se queda vacía)
          if (time === '09:30' && ![2, 4].includes(isoDow(d))) continue
          trainingSessions.push({
            id: randomUUID(), type: 'group', session_date: d, session_time: time,
            session_label: ['A', 'B', 'C'][day % 3], cycle_id: cycleId, day_index: day,
            max_clients: 6, duration_min: 60, status: 'scheduled',
            assigned_employee_id: trainerIds[k % 2 === 0 ? 0 : 1 + (day % 2)],
          })
        }
        d = addDays(d, 1)
      }
    }
  }
  await insertChunks(db, 'group_cycles', cycles)
  await insertChunks(db, 'training_sessions', trainingSessions)
  const sessionsBySlot = new Map<string, typeof trainingSessions>()
  for (const s of trainingSessions) {
    const k = `${isoDow(s.session_date)}|${s.session_time}`
    sessionsBySlot.set(k, [...(sessionsBySlot.get(k) ?? []), s])
  }

  // 3. Clientes: fechas de alta repartidas con estacionalidad
  type Scenario = { name: string; note: string; profile: Profile; altaOffset?: number; special: string }
  const scenarios: Scenario[] = [
    { name: 'Demo Constante', note: 'Cliente constante, adherencia alta', profile: 'constante', altaOffset: 300, special: 'none' },
    { name: 'Demo Seapaga', note: 'Va dejando de venir: alerta de adherencia baja', profile: 'apagandose', altaOffset: 200, special: 'fading' },
    { name: 'Demo Inactivo', note: 'Plan terminado hace 45 días, sin baja: alerta de inactividad', profile: 'normal', altaOffset: 140, special: 'inactive45' },
    { name: 'Demo Terminapronto', note: 'Plan que termina en 7 días sin renovar', profile: 'normal', altaOffset: 90, special: 'ending7' },
    { name: 'Demo Reactivado', note: 'Se dio de baja y volvió', profile: 'normal', altaOffset: 330, special: 'reactivated' },
  ]
  const totalDays = daysBetween(start, today)
  const weightedAltas: string[] = []
  while (weightedAltas.length < N_CLIENTS - scenarios.length) {
    const d = addDays(start, Math.floor(rand() * (totalDays - 20)))
    if (chance(MONTH_WEIGHT[Number(d.slice(5, 7)) - 1] / 1.7)) weightedAltas.push(d)
  }

  type Client = { id: string; first_name: string; last_name: string; start_date: string; profile: Profile; group: boolean; special: string; note: string | null }
  const clients: Client[] = []
  for (const s of scenarios) {
    const [first, last] = s.name.split(' ')
    clients.push({ id: randomUUID(), first_name: first, last_name: last, start_date: addDays(today, -(s.altaOffset ?? 100)), profile: s.profile, group: false, special: s.special, note: s.note })
  }
  for (const d of weightedAltas) {
    const profile: Profile = pick(['constante', 'normal', 'normal', 'normal', 'flojo', 'flojo'])
    clients.push({ id: randomUUID(), first_name: pick(FIRST), last_name: `${pick(LAST)} ${pick(LAST)}`, start_date: d, profile, group: chance(0.5), special: 'none', note: null })
  }

  await insertChunks(db, 'clients', clients.map(c => ({
    id: c.id, first_name: c.first_name, last_name: c.last_name,
    sex: chance(0.5) ? 'female' : 'male', birth_date: `${between(1960, 2002)}-0${between(1, 9)}-1${between(0, 9)}`,
    height_cm: between(155, 192), weight_kg: between(52, 95), start_date: c.start_date,
    notes: c.note ? `[Demo] ${c.note}` : '[Demo]', is_demo: true,
  })))
  // El trigger crea un periodo de alta abierto por cliente

  // 4. Planes, sesiones, registros y bajas
  type PlanRow = { id: string; client_id: string; start_date: string; end_date: string; status: string; ended_on?: string; [k: string]: unknown }
  const plans: PlanRow[] = []
  const planSessions: object[] = []
  const sessionLogs: object[] = []
  const exerciseLogs: object[] = []
  const seats: object[] = []
  const bajas: { client_id: string; date: string; reason_id: string; reactivate_on?: string }[] = []

  const logSession = (c: Client, opts: { planSessionId?: string; trainingSessionId?: string; date: string; employee: string; week?: number; progress: number }) => {
    const logId = randomUUID()
    sessionLogs.push({
      id: logId, plan_session_id: opts.planSessionId ?? null, training_session_id: opts.trainingSessionId ?? null,
      client_id: c.id, employee_id: opts.employee, date: opts.date, status: 'completed',
      started_at: `${opts.date}T17:00:00Z`, completed_at: `${opts.date}T18:00:00Z`,
    })
    const targetRpe = opts.week ? [6, 7, 8, 7.5][opts.week - 1] : 7
    const targetRir = opts.week ? [6, 3, 2, 2.5][opts.week - 1] : 3
    const exIdx = Math.abs(c.id.charCodeAt(0) + c.id.charCodeAt(1))
    for (let k = 0; k < 3; k++) {
      const ex = exercises[(exIdx + k * 7) % exercises.length]
      const baseLoad = 10 + ((exIdx + k * 13) % 50)
      exerciseLogs.push({
        session_log_id: logId, exercise_id: ex.id, sets_done: between(3, 4), reps_done: between(6, 12),
        load_kg: Math.round(baseLoad * (1 + opts.progress) * 2) / 2,
        rpe: Math.max(1, Math.min(10, Math.round(targetRpe + (rand() - 0.5) * 2))),
        rir: Math.max(0, Math.min(10, Math.round(targetRir + (rand() - 0.5) * 2))),
        skipped: false,
      })
    }
  }

  for (const c of clients) {
    const employee = c.special === 'none' ? pickTrainer() : trainerIds[1]
    const weekdays = c.group ? [] : (chance(0.5) ? [1, 3] : [2, 4, 5].slice(0, between(2, 3)))
    const time = pick(['08:00', '10:00', '17:00', '18:30', '20:00'])
    const slots = c.group
      ? [...new Set([1, 2, 3, 4, 5].sort(() => rand() - 0.5).slice(0, 3))].map(dow => {
          const t = pick(GROUP_SLOTS.filter(s => chance(SLOT_POPULARITY[s])).concat(['18:00']))
          return `${dow}|${t}`
        })
      : []

    // Cadena de planes de 3 meses mientras siga en el centro
    let planStart = addDays(c.start_date, between(0, 5))
    let stayed = true
    let left: string | null = null
    let reactivateOn: string | null = null
    let cycleCount = 0
    const renewProb = { constante: 0.9, normal: 0.7, flojo: 0.45, apagandose: 0.8 }[c.profile]

    while (stayed && planStart <= today) {
      cycleCount++
      const months = 3
      let planEnd = addDays(addMonths(planStart, months), -1)

      // Escenarios con fechas fijas
      if (c.special === 'inactive45' && cycleCount === 1) planEnd = addDays(today, -46)
      if (c.special === 'ending7' && cycleCount === 1) planEnd = addDays(today, 7)

      const planId = randomUUID()
      plans.push({
        id: planId, client_id: c.id, assigned_employee_id: employee, type: c.group ? 'group' : 'individual',
        level: between(1, 3), status: 'active', duration_months: months, weekly_frequency: c.group ? 3 : weekdays.length,
        session_duration: 60, start_date: planStart, end_date: planEnd, created_by: employee,
        created_at: `${planStart}T09:00:00Z`,
      })

      // Sesiones del plan
      const adherenceBase = ADHERENCE[c.profile]
      for (let d = planStart; d <= planEnd; d = addDays(d, 1)) {
        const dow = isoDow(d)
        const weeksIn = daysBetween(c.start_date, d) / 7
        let adherence = adherenceBase
        if (c.special === 'fading' && daysBetween(d, today) <= 35) adherence = 0.25
        const progress = Math.min(0.35, weeksIn * 0.008) * (c.profile === 'flojo' ? 0.3 : 1)
        if (!c.group) {
          if (!weekdays.includes(dow) || holidaySet.has(d)) continue
          const psId = randomUUID()
          planSessions.push({ id: psId, plan_id: planId, session_date: d, session_time: time, order_index: 0 })
          if (d < today && chance(adherence)) logSession(c, { planSessionId: psId, date: d, employee, progress })
        } else {
          for (const slot of slots) {
            const [sDow] = slot.split('|')
            if (Number(sDow) !== dow) continue
            const ts = sessionsBySlot.get(slot)?.find(s => s.session_date === d)
            if (!ts) continue
            seats.push({ session_id: ts.id, client_id: c.id, difficulty: pick(['regression', 'base', 'progression']) })
            if (d < today && chance(adherence)) {
              logSession(c, { trainingSessionId: ts.id, date: d, employee: ts.assigned_employee_id, week: Math.floor(ts.day_index / 5) + 1, progress })
            }
          }
        }
      }

      if (planEnd >= today) break
      if (c.special === 'inactive45') break

      // ¿Renueva, se queda inactivo o se va?
      if (c.special === 'reactivated' && cycleCount === 1) {
        left = addDays(planEnd, 10)
        reactivateOn = addDays(left, 60)
        break
      }
      if (chance(renewProb)) {
        planStart = addDays(planEnd, chance(0.8) ? 1 : between(3, 12))
      } else if (chance(0.75)) {
        const d = addDays(planEnd, between(5, 25))
        if (d <= today) left = d
        stayed = false
      } else {
        stayed = false // se queda inactivo sin darse de baja
      }
    }

    if (left) bajas.push({ client_id: c.id, date: left, reason_id: pick(reasonList).id, reactivate_on: reactivateOn ?? undefined })

    // Reactivado: plan nuevo después de volver
    if (reactivateOn && reactivateOn <= today) {
      const planStart2 = addDays(reactivateOn, 3)
      const planEnd2 = addDays(addMonths(planStart2, 3), -1)
      const planId = randomUUID()
      plans.push({
        id: planId, client_id: c.id, assigned_employee_id: employee, type: 'individual', level: 2, status: 'active',
        duration_months: 3, weekly_frequency: 2, session_duration: 60, start_date: planStart2, end_date: planEnd2,
        created_by: employee, created_at: `${planStart2}T09:00:00Z`,
      })
      for (let d = planStart2; d <= planEnd2; d = addDays(d, 1)) {
        if (![2, 4].includes(isoDow(d)) || holidaySet.has(d)) continue
        const psId = randomUUID()
        planSessions.push({ id: psId, plan_id: planId, session_date: d, session_time: '18:30', order_index: 0 })
        if (d < today && chance(0.85)) logSession(c, { planSessionId: psId, date: d, employee, progress: 0.05 })
      }
    }
  }

  // Estado de los planes: los sustituidos pasan a completed con su fin efectivo
  const plansByClient = new Map<string, PlanRow[]>()
  for (const p of plans) plansByClient.set(p.client_id, [...(plansByClient.get(p.client_id) ?? []), p])
  const bajaByClient = new Map(bajas.map(b => [b.client_id, b]))
  for (const list of plansByClient.values()) {
    list.sort((a, b) => a.start_date.localeCompare(b.start_date))
    list.forEach((p, i) => {
      const next = list[i + 1]
      const baja = bajaByClient.get(p.client_id)
      if (next) {
        p.status = 'completed'
        if (next.start_date <= p.end_date) p.ended_on = addDays(next.start_date, -1)
      } else if (baja && baja.date >= p.start_date && (!baja.reactivate_on || baja.reactivate_on > today) && baja.date <= p.end_date) {
        p.status = 'cancelled'
        p.ended_on = baja.date
      }
    })
  }

  console.log(`  ${clients.length} clientes, ${plans.length} planes, ${planSessions.length} sesiones individuales, ${seats.length} plazas grupales, ${sessionLogs.length} registros`)
  await insertChunks(db, 'training_plans', plans)
  await insertChunks(db, 'plan_sessions', planSessions)
  await insertChunks(db, 'training_session_clients', seats)
  await insertChunks(db, 'session_logs', sessionLogs)
  await insertChunks(db, 'exercise_logs', exerciseLogs, 1000)

  // Bajas (y reactivaciones) en el historial de periodos
  for (const b of bajas) {
    const { error } = await db.from('client_periods')
      .update({ ended_on: b.date, end_reason_id: b.reason_id, updated_at: new Date().toISOString() })
      .eq('client_id', b.client_id).is('ended_on', null)
    if (error) throw new Error('Baja: ' + error.message)
    if (b.reactivate_on && b.reactivate_on <= today) {
      const { error: rErr } = await db.from('client_periods').insert({ client_id: b.client_id, started_on: b.reactivate_on })
      if (rErr) throw new Error('Reactivación: ' + rErr.message)
    }
  }
  // Las sesiones de clientes de baja posteriores a la baja no deberían existir
  for (const b of bajas) {
    if (b.reactivate_on && b.reactivate_on <= today) continue
    const { data: clientPlans } = await db.from('training_plans').select('id').eq('client_id', b.client_id)
    const ids = (clientPlans ?? []).map(p => p.id)
    if (ids.length) await db.from('plan_sessions').delete().in('plan_id', ids).gt('session_date', b.date)
  }

  console.log(`  ${bajas.length} bajas. Demo creada.`)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
