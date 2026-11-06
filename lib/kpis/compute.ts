// Cálculo de los indicadores a partir de las filas mensuales de kpi_monthly()
// (docs/spec-kpis.md §4 y §5). Funciones puras: sin acceso a BD, testeables.
//
// Regla general: un KPI cuyo divisor es 0 devuelve null ("sin datos"), nunca 0.

export type MonthlyRow = {
  month: string
  metric: string
  dim: string | null
  employee_id: string | null
  plan_type: string | null
  num: number
  den: number | null
}

export type PlanTypeFilter = 'all' | 'individual' | 'group'
// 'all' = todos; 'none' = sin entrenador asignado; uuid = un entrenador
export type EmployeeFilter = string

export type Filters = { employee: EmployeeFilter; type: PlanTypeFilter }

export const NO_EMPLOYEE = 'none'

export function matchesEmployee(id: string | null, filter: EmployeeFilter): boolean {
  if (filter === 'all') return true
  if (filter === NO_EMPLOYEE) return id === null
  return id === filter
}

export function filterRows(rows: MonthlyRow[], filters: Filters): MonthlyRow[] {
  return rows.filter(r => {
    if (!matchesEmployee(r.employee_id, filters.employee)) return false
    // Las horas disponibles son del entrenador, no de un tipo de plan
    if (filters.type !== 'all' && r.metric !== 'avail' && r.plan_type !== filters.type) return false
    return true
  })
}

function pct(num: number, den: number): number | null {
  return den > 0 ? (100 * num) / den : null
}

function sum(rows: MonthlyRow[], metric: string, months: Set<string>, dim?: string) {
  let num = 0
  let den = 0
  for (const r of rows) {
    if (r.metric !== metric || !months.has(r.month)) continue
    if (dim !== undefined && r.dim !== dim) continue
    num += Number(r.num) || 0
    den += Number(r.den) || 0
  }
  return { num, den }
}

function byDim(rows: MonthlyRow[], metric: string, months: Set<string>) {
  const out = new Map<string, { num: number; den: number }>()
  for (const r of rows) {
    if (r.metric !== metric || !months.has(r.month)) continue
    const key = r.dim ?? ''
    const acc = out.get(key) ?? { num: 0, den: 0 }
    acc.num += Number(r.num) || 0
    acc.den += Number(r.den) || 0
    out.set(key, acc)
  }
  return out
}

export type Snapshot = {
  hasClients: boolean
  clients: { active: number; inactive: number; baja: number }
  altas: { new: number; reactivation: number; total: number }
  bajas: { total: number; byReason: { reason: string; n: number }[] }
  churn: number | null
  retention: { renewed: number; notRenewed: number; pending: number; pct: number | null }
  sessions: { completed: number; missed: number; scheduled: number; cancelled: number; unrecorded: number }
  adherence: number | null
  groupOcc: { booked: number; seats: number; pct: number | null; attended: number; recordedBooked: number; attPct: number | null }
  trainerOcc: { minutes: number; availMinutes: number; minutesWithAvail: number; pct: number | null }
  imparted: number
  rpeByWeek: { week: number; rpe: number | null; rir: number | null; n: number }[]
}

// Indicadores de un conjunto de meses (ya filtradas las filas por entrenador y tipo).
export function computeSnapshot(rows: MonthlyRow[], months: string[]): Snapshot {
  const set = new Set(months)
  const last = new Set(months.slice(-1))

  const stateRows = rows.filter(r => r.metric === 'state' && last.has(r.month))
  const clients = {
    active: sum(stateRows, 'state', last, 'active').num,
    inactive: sum(stateRows, 'state', last, 'inactive').num,
    baja: sum(stateRows, 'state', last, 'baja').num,
  }

  const altasNew = sum(rows, 'altas', set, 'new').num
  const altasRe = sum(rows, 'altas', set, 'reactivation').num

  const bajasMap = byDim(rows, 'bajas', set)
  const byReason = [...bajasMap.entries()]
    .map(([reason, v]) => ({ reason: reason || 'Sin motivo', n: v.num }))
    .sort((a, b) => b.n - a.n)
  const bajasTotal = byReason.reduce((acc, r) => acc + r.n, 0)

  // Churn: media de los meses con base > 0 (churn mensual = bajas ÷ de alta el día 1)
  const monthly: number[] = []
  for (const m of months) {
    const one = new Set([m])
    const base = sum(rows, 'churn_base', one).num
    if (base > 0) monthly.push((100 * sum(rows, 'bajas', one).num) / base)
  }
  const churn = monthly.length > 0 ? monthly.reduce((a, b) => a + b, 0) / monthly.length : null

  const renewed = sum(rows, 'retention', set, 'renewed').num
  const notRenewed = sum(rows, 'retention', set, 'not_renewed').num
  const pending = sum(rows, 'retention', set, 'pending').num

  const sessions = {
    completed: sum(rows, 'sessions', set, 'completed').num,
    missed: sum(rows, 'sessions', set, 'missed').num,
    scheduled: sum(rows, 'sessions', set, 'scheduled').num,
    cancelled: sum(rows, 'sessions', set, 'cancelled').num,
    unrecorded: sum(rows, 'sessions', set, 'unrecorded').num,
  }

  const occ = sum(rows, 'occ', set)
  const att = sum(rows, 'occ_att', set)

  // Ocupación de entrenadores: solo cuentan los que tienen horas disponibles
  const availByEmp = new Map<string, number>()
  for (const r of rows) {
    if (r.metric === 'avail' && set.has(r.month) && r.employee_id) {
      availByEmp.set(r.employee_id, (availByEmp.get(r.employee_id) ?? 0) + Number(r.num))
    }
  }
  let minutes = 0
  let minutesWithAvail = 0
  for (const r of rows) {
    if (r.metric !== 'hours' || !set.has(r.month)) continue
    minutes += Number(r.num)
    if (r.employee_id && availByEmp.has(r.employee_id)) minutesWithAvail += Number(r.num)
  }
  const availMinutes = [...availByEmp.values()].reduce((a, b) => a + b, 0)

  const rpeByWeek = [1, 2, 3, 4].map(week => {
    const rpe = sum(rows, 'rpe', set, String(week))
    const rir = sum(rows, 'rir', set, String(week))
    return {
      week,
      rpe: rpe.den > 0 ? rpe.num / rpe.den : null,
      rir: rir.den > 0 ? rir.num / rir.den : null,
      n: rpe.den,
    }
  })

  return {
    hasClients: stateRows.length > 0,
    clients,
    altas: { new: altasNew, reactivation: altasRe, total: altasNew + altasRe },
    bajas: { total: bajasTotal, byReason },
    churn,
    retention: { renewed, notRenewed, pending, pct: pct(renewed, renewed + notRenewed) },
    sessions,
    adherence: pct(sessions.completed, sessions.completed + sessions.missed),
    groupOcc: { booked: occ.num, seats: occ.den, pct: pct(occ.num, occ.den), attended: att.num, recordedBooked: att.den, attPct: pct(att.num, att.den) },
    trainerOcc: { minutes, availMinutes, minutesWithAvail, pct: pct(minutesWithAvail, availMinutes) },
    imparted: sum(rows, 'imparted', set).num,
    rpeByWeek,
  }
}

// Mapa de calor de la ocupación grupal: franja (día de la semana × hora).
export type HeatCell = { dow: number; time: string; booked: number; seats: number; pct: number | null; attPct: number | null }

export function computeHeatmap(rows: MonthlyRow[], months: string[]): HeatCell[] {
  const set = new Set(months)
  const occ = byDim(rows, 'occ', set)
  const att = byDim(rows, 'occ_att', set)
  return [...occ.entries()].map(([key, v]) => {
    const [dow, time] = key.split('|')
    const a = att.get(key)
    return {
      dow: Number(dow),
      time,
      booked: v.num,
      seats: v.den,
      pct: pct(v.num, v.den),
      attPct: a ? pct(a.num, a.den) : null,
    }
  })
}

// Fila de la tabla de entrenadores.
export type TrainerRow = {
  employeeId: string | null
  activeClients: number
  imparted: number
  hours: number
  availHours: number | null
  occupancy: number | null
  adherence: number | null
  retention: number | null
  bajas: number
}

export function computeTrainerRows(
  rows: MonthlyRow[],
  months: string[],
  type: PlanTypeFilter,
  employeeIds: (string | null)[],
): TrainerRow[] {
  return employeeIds.map(id => {
    const own = filterRows(rows, { employee: id ?? NO_EMPLOYEE, type })
    const s = computeSnapshot(own, months)
    const hasAvail = s.trainerOcc.availMinutes > 0
    return {
      employeeId: id,
      activeClients: s.clients.active,
      imparted: s.imparted,
      hours: s.trainerOcc.minutes / 60,
      availHours: hasAvail ? s.trainerOcc.availMinutes / 60 : null,
      occupancy: s.trainerOcc.pct,
      adherence: s.adherence,
      retention: s.retention.pct,
      bajas: s.bajas.total,
    }
  })
}

// Progresión de carga (kpi_progress)
export type ProgressRow = { client_id: string; employee_id: string | null; plan_type: string | null; class: 'up' | 'flat' | 'down' | 'nodata'; variation: number | null }

export type ProgressSummary = { up: number; flat: number; down: number; nodata: number; upPct: number | null }

export function summarizeProgress(rows: ProgressRow[], filters: Filters): ProgressSummary {
  const out = { up: 0, flat: 0, down: 0, nodata: 0 }
  for (const r of rows) {
    if (!matchesEmployee(r.employee_id, filters.employee)) continue
    if (filters.type !== 'all' && r.plan_type !== filters.type) continue
    out[r.class]++
  }
  return { ...out, upPct: pct(out.up, out.up + out.flat + out.down) }
}

// Semáforo frente a un objetivo (docs/spec-kpis.md §6): ámbar a menos del 10 % del umbral.
export type Target = { key: string; label: string; unit: string; value_min: number | null; value_max: number | null; sort_order: number }
export type TrafficLight = 'good' | 'warning' | 'critical'

export function trafficLight(value: number | null, target: Target | undefined): TrafficLight | null {
  if (value === null || !target) return null
  const { value_min: min, value_max: max } = target
  if (min !== null && max !== null) {
    if (value >= min && value <= max) return 'good'
    if (value >= min * 0.9 && value <= max * 1.1) return 'warning'
    return 'critical'
  }
  if (min !== null) {
    if (value >= min) return 'good'
    return value >= min * 0.9 ? 'warning' : 'critical'
  }
  if (max !== null) {
    if (value <= max) return 'good'
    return value <= max * 1.1 ? 'warning' : 'critical'
  }
  return null
}
