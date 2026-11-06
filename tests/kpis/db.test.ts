// Test de integración de las funciones kpi_* contra la BD de Supabase
// (docs/spec-kpis.md §11.3). Escribe datos de prueba marcados is_demo en un
// mes vacío (marzo de 2024), comprueba los resultados exactos y los borra.
//
// Solo se ejecuta con ALLOW_DEMO_SEED=true (escribe en la BD):
//   PowerShell: $env:ALLOW_DEMO_SEED='true'; npm run test:db

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { computeSnapshot, type MonthlyRow } from '@/lib/kpis/compute'
import { loadKpis } from '@/lib/kpis/load'

function loadEnv() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2]
    }
  } catch { /* sin .env.local */ }
}
loadEnv()

const enabled = process.env.ALLOW_DEMO_SEED === 'true' && !!process.env.SUPABASE_SECRET_KEY
const LAST_NAME = 'KPI-Test'

describe.skipIf(!enabled)('funciones kpi_* (BD)', () => {
  let db: SupabaseClient
  const A: string = randomUUID() // renueva
  const B: string = randomUUID() // no renueva y se da de baja
  const C: string = randomUUID() // alta en marzo sin plan: inactivo

  async function cleanup() {
    await db.from('clients').delete().eq('is_demo', true).eq('last_name', LAST_NAME)
  }

  beforeAll(async () => {
    db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } })
    await cleanup()

    const base = { last_name: LAST_NAME, sex: 'other', birth_date: '1990-01-01', height_cm: 170, weight_kg: 70, is_demo: true, notes: '[Demo] test de integración' }
    let r = await db.from('clients').insert([
      { ...base, id: A, first_name: 'A', start_date: '2024-01-10' },
      { ...base, id: B, first_name: 'B', start_date: '2024-02-01' },
      { ...base, id: C, first_name: 'C', start_date: '2024-03-05' },
    ])
    if (r.error) throw r.error

    const A1 = randomUUID(), A2 = randomUUID(), B1 = randomUUID()
    const plan = { level: 2, weekly_frequency: 1, session_duration: 60, duration_months: 2 }
    r = await db.from('training_plans').insert([
      { ...plan, id: A1, client_id: A, type: 'individual', status: 'completed', start_date: '2024-01-10', end_date: '2024-03-15' },
      { ...plan, id: A2, client_id: A, type: 'individual', status: 'active', start_date: '2024-03-20', end_date: '2024-06-19' },
      { ...plan, id: B1, client_id: B, type: 'individual', status: 'active', start_date: '2024-02-01', end_date: '2024-03-10' },
    ])
    if (r.error) throw r.error

    // 4 sesiones de A en marzo, 3 completadas → adherencia 75 %
    const sessions = ['2024-03-04', '2024-03-11', '2024-03-21', '2024-03-28'].map((d, i) => ({
      id: randomUUID(), plan_id: d < '2024-03-20' ? A1 : A2, session_date: d, session_time: '18:00', order_index: i,
    }))
    r = await db.from('plan_sessions').insert(sessions)
    if (r.error) throw r.error
    r = await db.from('session_logs').insert(sessions.slice(0, 3).map(s => ({
      plan_session_id: s.id, client_id: A, date: s.session_date, status: 'completed',
    })))
    if (r.error) throw r.error

    // Baja de B el 25 de marzo
    const { data: reason } = await db.from('client_end_reasons').select('id').eq('label', 'Precio').single()
    r = await db.from('client_periods').update({ ended_on: '2024-03-25', end_reason_id: reason!.id }).eq('client_id', B).is('ended_on', null)
    if (r.error) throw r.error
  })

  afterAll(async () => {
    if (db) await cleanup()
  })

  it('kpi_client_states: estados a fin de marzo', async () => {
    const { data, error } = await db.rpc('kpi_client_states', { p_date: '2024-03-31' })
    expect(error).toBeNull()
    const mine = Object.fromEntries((data as { client_id: string; state: string }[]).filter(s => [A, B, C].includes(s.client_id)).map(s => [s.client_id, s.state]))
    expect(mine).toEqual({ [A]: 'active', [B]: 'baja', [C]: 'inactive' })
  })

  it('kpi_monthly: altas, bajas, churn, retención y adherencia de marzo', async () => {
    const { data, error } = await db.rpc('kpi_monthly', { p_from: '2024-03-01', p_to: '2024-03-31' })
    expect(error).toBeNull()
    const s = computeSnapshot(data as MonthlyRow[], ['2024-03-01'])
    expect(s.clients).toEqual({ active: 1, inactive: 1, baja: 1 })
    expect(s.altas).toEqual({ new: 1, reactivation: 0, total: 1 })
    expect(s.bajas.byReason).toEqual([{ reason: 'Precio', n: 1 }])
    expect(s.churn).toBe(50)                         // 1 baja ÷ 2 de alta el 1 de marzo
    expect(s.retention).toMatchObject({ renewed: 1, notRenewed: 1, pct: 50 })
    expect(s.sessions).toMatchObject({ completed: 3, missed: 1 })
    expect(s.adherence).toBe(75)
  })

  it('kpi_monthly: reactivación', async () => {
    let r = await db.from('client_periods').insert({ client_id: B, started_on: '2024-04-10' })
    expect(r.error).toBeNull()
    const { data } = await db.rpc('kpi_monthly', { p_from: '2024-04-01', p_to: '2024-04-30' })
    const s = computeSnapshot(data as MonthlyRow[], ['2024-04-01'])
    expect(s.altas).toEqual({ new: 0, reactivation: 1, total: 1 })
    expect(s.clients).toEqual({ active: 1, inactive: 2, baja: 0 })
    r = await db.from('client_periods').delete().eq('client_id', B).eq('started_on', '2024-04-10')
    expect(r.error).toBeNull()
  })

  it('clients.is_active refleja el periodo abierto', async () => {
    const { data } = await db.from('clients').select('id, is_active').in('id', [A, B])
    expect(Object.fromEntries((data ?? []).map(c => [c.id, c.is_active]))).toEqual({ [A]: true, [B]: false })
  })

  it('loadKpis carga el panel completo sin errores (con paginación)', async () => {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const data = await loadKpis(createAdminClient(), { periodo: '12m' })
    expect(data.series).toHaveLength(12)
    expect(data.targets.length).toBeGreaterThan(0)
    expect(data.weekTargets).toHaveLength(4)
  })
})
