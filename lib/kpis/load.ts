import 'server-only'

import type { createAdminClient } from '@/lib/supabase/admin'
import { getCenterToday } from '@/lib/center-settings'
import {
  type Filters, type MonthlyRow, type PainRow, type PlanTypeFilter, type ProgressRow, type Snapshot, type Target,
  NO_EMPLOYEE, computeHeatmap, computePain, computeSnapshot, computeTrainerRows, filterRows, matchesEmployee, summarizeProgress,
} from './compute'
import {
  type CompareKey, type Period, comparisonPeriod, periodRefDate, resolvePeriod, seriesMonths,
} from './period'

type AdminClient = ReturnType<typeof createAdminClient>

// Carga y calcula todo el panel de indicadores. Solo servidor: las funciones
// kpi_* solo las puede ejecutar service_role (docs/spec-kpis.md §10.2), así
// que quien llame debe haber comprobado antes requirePermission('indicadores.ver').

export type KpiParams = {
  periodo?: string
  comparar?: string
  entrenador?: string
  tipo?: string
}

export type Employee = { id: string; name: string; weeklyHours: number | null; isStaff: boolean }

export type Alert = {
  kind: 'inactive' | 'plan_ending' | 'low_adherence'
  client_id: string
  client_name: string
  value: number
  ref_date: string | null
  employee_id: string | null
  plan_type: string | null
}

export type WeekTarget = { week: number; phase_name: string; rpe_min: number; rpe_max: number; rir_min: number; rir_max: number }

export type SeriesPoint = { month: string; snapshot: Snapshot }

export function parseFilters(params: KpiParams): { filters: Filters; compare: CompareKey } {
  const type: PlanTypeFilter = params.tipo === 'individual' || params.tipo === 'group' ? params.tipo : 'all'
  const employee = params.entrenador && /^([0-9a-f-]{36}|none)$/.test(params.entrenador) ? params.entrenador : 'all'
  const compare: CompareKey = params.comparar === 'anio-anterior' ? 'anio-anterior' : 'anterior'
  return { filters: { employee, type }, compare }
}

// La API devuelve como máximo 1000 filas por llamada: se pagina con un orden estable.
const PAGE = 1000
async function fetchMonthly(admin: AdminClient, from: string, to: string): Promise<MonthlyRow[]> {
  const out: MonthlyRow[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin
      .rpc('kpi_monthly', { p_from: from, p_to: to })
      .order('month').order('metric').order('dim').order('employee_id').order('plan_type')
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error('Error al calcular los indicadores: ' + error.message)
    const rows = (data ?? []) as MonthlyRow[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

async function fetchAll<T>(admin: AdminClient, fn: 'kpi_progress' | 'kpi_alerts', args?: Record<string, string>): Promise<T[]> {
  const out: T[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.rpc(fn, args).order('client_id').range(offset, offset + PAGE - 1)
    if (error) throw new Error('Error al calcular los indicadores: ' + error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

// Feedback del cliente con la fecha, el entrenador y el tipo de su sesión
// (client_sessions solo la lee service_role). Se pagina igual que el resto.
async function fetchPainRows(admin: AdminClient): Promise<PainRow[]> {
  const feedback: { target_id: string; pain: boolean }[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin.from('client_feedback').select('target_id, pain')
      .eq('kind', 'feedback').order('id').range(offset, offset + PAGE - 1)
    if (error) throw new Error('Error al calcular los indicadores: ' + error.message)
    feedback.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
  }
  if (feedback.length === 0) return []

  const sessions = new Map<string, { session_date: string; employee_id: string | null; type: string | null }>()
  const ids = [...new Set(feedback.map(f => f.target_id))]
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin.from('client_sessions').select('source_id, session_date, employee_id, type')
      .in('source_id', ids.slice(i, i + 200))
    if (error) throw new Error('Error al calcular los indicadores: ' + error.message)
    for (const s of data ?? []) sessions.set(s.source_id, s)
  }
  return feedback.flatMap(f => {
    const s = sessions.get(f.target_id)
    return s ? [{ session_date: s.session_date, employee_id: s.employee_id, plan_type: s.type, pain: f.pain }] : []
  })
}

export async function loadKpis(admin: AdminClient, params: KpiParams) {
  const today = await getCenterToday(admin)
  const period: Period = resolvePeriod(params.periodo, today)
  const { filters, compare } = parseFilters(params)
  const comparison = comparisonPeriod(period, compare)
  const series = seriesMonths(period)

  const fetchFrom = [comparison.from, series[0], period.from].sort()[0]
  const refDate = periodRefDate(period, today)
  const compRefDate = periodRefDate(comparison, today)

  const [rows, progressNow, progressPrev, alerts, targetsRes, weekRes, profilesRes, painRows] = await Promise.all([
    fetchMonthly(admin, fetchFrom, period.to),
    fetchAll<ProgressRow>(admin, 'kpi_progress', { p_to: refDate }),
    fetchAll<ProgressRow>(admin, 'kpi_progress', { p_to: compRefDate }),
    fetchAll<Alert>(admin, 'kpi_alerts'),
    admin.from('kpi_targets').select('key, label, unit, value_min, value_max, sort_order').order('sort_order'),
    admin.from('cycle_week_targets').select('*').order('week'),
    admin.from('profiles').select('id, full_name, role, is_active, weekly_hours'),
    fetchPainRows(admin),
  ])

  // Entrenadores: el personal activo más cualquiera que aparezca en los datos
  const profiles = profilesRes.data ?? []
  const employees = new Map<string, Employee>()
  for (const p of profiles) {
    if ((p.role === 'employee' || p.role === 'admin') && p.is_active) {
      employees.set(p.id, { id: p.id, name: p.full_name || 'Sin nombre', weeklyHours: p.weekly_hours, isStaff: true })
    }
  }
  const seenIds = new Set<string>()
  for (const r of rows) if (r.employee_id) seenIds.add(r.employee_id)
  for (const id of seenIds) {
    if (!employees.has(id)) {
      const p = profiles.find(x => x.id === id)
      employees.set(id, { id, name: p?.full_name || 'Usuario sin perfil', weeklyHours: p?.weekly_hours ?? null, isStaff: false })
    }
  }

  const filtered = filterRows(rows, filters)
  const current = computeSnapshot(filtered, period.months)
  const previous = computeSnapshot(filtered, comparison.months)
  const seriesPoints: SeriesPoint[] = series.map(m => ({ month: m, snapshot: computeSnapshot(filtered, [m]) }))

  const trainerIds: (string | null)[] = [...employees.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .map(e => e.id)
  const hasUnassigned = rows.some(r => r.employee_id === null && r.metric !== 'avail')
  if (hasUnassigned) trainerIds.push(null)
  const trainers = computeTrainerRows(rows, period.months, filters.type, trainerIds)
    .filter(t => filters.employee === 'all' || matchesEmployee(t.employeeId, filters.employee))

  const filteredAlerts = alerts.filter(a =>
    matchesEmployee(a.employee_id, filters.employee) &&
    (filters.type === 'all' || a.plan_type === filters.type),
  )

  return {
    today,
    period,
    comparison,
    compare,
    filters,
    current,
    previous,
    series: seriesPoints,
    heatmap: computeHeatmap(filtered, period.months),
    trainers,
    progress: summarizeProgress(progressNow, filters),
    progressPrev: summarizeProgress(progressPrev, filters),
    pain: computePain(painRows, period.months, filters),
    painPrev: computePain(painRows, comparison.months, filters),
    alerts: filteredAlerts,
    targets: (targetsRes.data ?? []) as Target[],
    weekTargets: (weekRes.data ?? []) as WeekTarget[],
    employees: [...employees.values()].sort((a, b) => a.name.localeCompare(b.name, 'es')),
  }
}

export type KpiData = Awaited<ReturnType<typeof loadKpis>>

export function employeeName(data: Pick<KpiData, 'employees'>, id: string | null): string {
  if (id === null || id === NO_EMPLOYEE) return 'Sin asignar'
  return data.employees.find(e => e.id === id)?.name ?? 'Desconocido'
}

// Resumen del mes en curso para la franja del Panel (solo admin).
export async function loadPanelSummary(admin: AdminClient) {
  const today = await getCenterToday(admin)
  const period = resolvePeriod('mes', today)
  const [rows, alerts] = await Promise.all([
    fetchMonthly(admin, period.from, period.to),
    fetchAll<Alert>(admin, 'kpi_alerts'),
  ])
  const s = computeSnapshot(rows, period.months)
  return { period, activeClients: s.hasClients ? s.clients.active : null, churn: s.churn, adherence: s.adherence, alerts: alerts.length }
}
