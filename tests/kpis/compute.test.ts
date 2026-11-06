import { describe, expect, it } from 'vitest'
import {
  type MonthlyRow, computeHeatmap, computeSnapshot, computeTrainerRows, filterRows, summarizeProgress, trafficLight,
} from '@/lib/kpis/compute'
import { comparisonPeriod, periodRefDate, resolvePeriod, seriesMonths } from '@/lib/kpis/period'
import { fmtDelta } from '@/lib/kpis/format'
import { clientStateOn } from '@/lib/client-state'
import { ageOn, todayIn } from '@/lib/center'

const E1 = '11111111-1111-1111-1111-111111111111'
const E2 = '22222222-2222-2222-2222-222222222222'

function row(month: string, metric: string, dim: string | null, num: number, den: number | null = null, employee_id: string | null = E1, plan_type: string | null = 'individual'): MonthlyRow {
  return { month, metric, dim, employee_id, plan_type, num, den }
}

describe('computeSnapshot', () => {
  it('distingue "sin datos" de 0 cuando el divisor es 0', () => {
    const s = computeSnapshot([], ['2026-10-01'])
    expect(s.hasClients).toBe(false)
    expect(s.churn).toBeNull()
    expect(s.retention.pct).toBeNull()
    expect(s.adherence).toBeNull()
    expect(s.groupOcc.pct).toBeNull()
    expect(s.trainerOcc.pct).toBeNull()
  })

  it('churn de varios meses = media de los churn mensuales', () => {
    const rows = [
      row('2026-09-01', 'churn_base', null, 10), row('2026-09-01', 'bajas', 'Precio', 1),   // 10 %
      row('2026-10-01', 'churn_base', null, 20), row('2026-10-01', 'bajas', 'Precio', 1),   // 5 %
      row('2026-11-01', 'churn_base', null, 0),                                             // sin base: no cuenta
    ]
    expect(computeSnapshot(rows, ['2026-09-01', '2026-10-01', '2026-11-01']).churn).toBeCloseTo(7.5)
  })

  it('retención excluye los planes pendientes de la ventana', () => {
    const rows = [
      row('2026-10-01', 'retention', 'renewed', 3),
      row('2026-10-01', 'retention', 'not_renewed', 1),
      row('2026-10-01', 'retention', 'pending', 5),
    ]
    const s = computeSnapshot(rows, ['2026-10-01'])
    expect(s.retention.pct).toBe(75)
    expect(s.retention.pending).toBe(5)
  })

  it('adherencia = completadas ÷ (completadas + no asistidas); las grupales sin registrar no cuentan', () => {
    const rows = [
      row('2026-10-01', 'sessions', 'completed', 6),
      row('2026-10-01', 'sessions', 'missed', 2),
      row('2026-10-01', 'sessions', 'scheduled', 4),
      row('2026-10-01', 'sessions', 'unrecorded', 9, null, E1, 'group'),
      row('2026-10-01', 'sessions', 'cancelled', 3),
    ]
    const s = computeSnapshot(rows, ['2026-10-01'])
    expect(s.adherence).toBe(75)
    expect(s.sessions.unrecorded).toBe(9)
  })

  it('el estado de los clientes es el del último mes del periodo', () => {
    const rows = [
      row('2026-09-01', 'state', 'active', 10),
      row('2026-10-01', 'state', 'active', 12),
      row('2026-10-01', 'state', 'inactive', 3),
      row('2026-10-01', 'state', 'baja', 1),
    ]
    expect(computeSnapshot(rows, ['2026-09-01', '2026-10-01']).clients).toEqual({ active: 12, inactive: 3, baja: 1 })
  })

  it('la ocupación de entrenadores solo usa a quien tiene horas disponibles', () => {
    const rows = [
      row('2026-10-01', 'hours', null, 600, null, E1),
      row('2026-10-01', 'hours', null, 300, null, E2), // sin horas configuradas
      row('2026-10-01', 'hours', null, 120, null, null), // sin asignar
      row('2026-10-01', 'avail', null, 1200, null, E1, null),
    ]
    const s = computeSnapshot(rows, ['2026-10-01'])
    expect(s.trainerOcc.minutes).toBe(1020)
    expect(s.trainerOcc.pct).toBe(50)
  })
})

describe('filtros', () => {
  const rows = [
    row('2026-10-01', 'hours', null, 60, null, E1, 'individual'),
    row('2026-10-01', 'hours', null, 60, null, E2, 'group'),
    row('2026-10-01', 'hours', null, 60, null, null, 'group'),
    row('2026-10-01', 'avail', null, 600, null, E2, null),
  ]
  it('por entrenador, incluido "sin asignar"', () => {
    expect(filterRows(rows, { employee: E2, type: 'all' })).toHaveLength(2)
    expect(filterRows(rows, { employee: 'none', type: 'all' })).toHaveLength(1)
  })
  it('por tipo de plan, sin quitar las horas disponibles', () => {
    const r = filterRows(rows, { employee: 'all', type: 'group' })
    expect(r.map(x => x.metric).sort()).toEqual(['avail', 'hours', 'hours'])
  })
  it('tabla de entrenadores con fila "sin asignar"', () => {
    const t = computeTrainerRows(rows, ['2026-10-01'], 'all', [E1, E2, null])
    expect(t.map(x => x.hours)).toEqual([1, 1, 1])
    expect(t[1].occupancy).toBe(10)
    expect(t[0].occupancy).toBeNull()
  })
})

describe('mapa de calor y progreso', () => {
  it('agrega plazas por franja', () => {
    const rows = [
      row('2026-10-01', 'occ', '1|07:00', 3, 6, E1, 'group'),
      row('2026-10-01', 'occ', '1|07:00', 3, 6, E2, 'group'),
      row('2026-10-01', 'occ_att', '1|07:00', 4, 6, E1, 'group'),
    ]
    const [cell] = computeHeatmap(rows, ['2026-10-01'])
    expect(cell).toMatchObject({ dow: 1, time: '07:00', booked: 6, seats: 12, pct: 50 })
    expect(cell.attPct).toBeCloseTo(66.67, 1)
  })
  it('% que progresa sobre los clientes con datos', () => {
    const p = summarizeProgress([
      { client_id: 'a', employee_id: E1, plan_type: 'individual', class: 'up', variation: 5 },
      { client_id: 'b', employee_id: E1, plan_type: 'individual', class: 'flat', variation: 0 },
      { client_id: 'c', employee_id: E1, plan_type: 'individual', class: 'nodata', variation: null },
      { client_id: 'd', employee_id: E2, plan_type: 'group', class: 'up', variation: 9 },
    ], { employee: E1, type: 'all' })
    expect(p).toEqual({ up: 1, flat: 1, down: 0, nodata: 1, upPct: 50 })
  })
})

describe('semáforo', () => {
  const min = { key: 'k', label: '', unit: '%', value_min: 80, value_max: null, sort_order: 0 }
  const max = { key: 'k', label: '', unit: '%', value_min: null, value_max: 5, sort_order: 0 }
  const range = { key: 'k', label: '', unit: '%', value_min: 60, value_max: 85, sort_order: 0 }
  it('mínimo, máximo y rango con ámbar a menos del 10 %', () => {
    expect(trafficLight(80, min)).toBe('good')
    expect(trafficLight(73, min)).toBe('warning')
    expect(trafficLight(70, min)).toBe('critical')
    expect(trafficLight(5, max)).toBe('good')
    expect(trafficLight(5.4, max)).toBe('warning')
    expect(trafficLight(6, max)).toBe('critical')
    expect(trafficLight(90, range)).toBe('warning')
    expect(trafficLight(100, range)).toBe('critical')
    expect(trafficLight(null, min)).toBeNull()
  })
})

describe('periodos', () => {
  const today = '2026-11-06'
  it('resuelve los periodos y sus comparativas', () => {
    expect(resolvePeriod(undefined, today).months).toEqual(['2026-11-01'])
    expect(resolvePeriod('mes-anterior', today).months).toEqual(['2026-10-01'])
    expect(resolvePeriod('trimestre', today).months).toEqual(['2026-10-01', '2026-11-01'])
    expect(resolvePeriod('anio', today).months).toHaveLength(11)
    expect(resolvePeriod('12m', today).from).toBe('2025-12-01')
    expect(resolvePeriod('2026-03', today).months).toEqual(['2026-03-01'])
    expect(resolvePeriod('2027-01', today).key).toBe('mes') // futuro: no se acepta
    const t = resolvePeriod('trimestre', today)
    expect(comparisonPeriod(t, 'anterior').months).toEqual(['2026-08-01', '2026-09-01'])
    expect(comparisonPeriod(t, 'anio-anterior').months).toEqual(['2025-10-01', '2025-11-01'])
    expect(seriesMonths(t)).toHaveLength(12)
    expect(seriesMonths(t)[11]).toBe('2026-11-01')
  })
  it('la fecha de referencia nunca pasa de hoy', () => {
    expect(periodRefDate(resolvePeriod('mes', today), today)).toBe(today)
    expect(periodRefDate(resolvePeriod('mes-anterior', today), today)).toBe('2026-10-31')
  })
})

describe('utilidades', () => {
  it('variación en puntos y en recuentos', () => {
    expect(fmtDelta(80, 75, 'pct')).toEqual({ text: '+5 pp', dir: 'up' })
    expect(fmtDelta(3, 5, 'count')).toEqual({ text: '−2', dir: 'down' })
    expect(fmtDelta(null, 5, 'count')).toBeNull()
  })
  it('estado del cliente en una fecha', () => {
    const periods = [{ started_on: '2026-01-01', ended_on: '2026-06-01' }, { started_on: '2026-09-01', ended_on: null }]
    const plans = [{ start_date: '2026-01-01', end_date: '2026-03-31', status: 'completed' }, { start_date: '2026-09-15', end_date: '2026-12-14', ended_on: null, status: 'active' }]
    expect(clientStateOn(periods, plans, '2025-12-31')).toBeNull()
    expect(clientStateOn(periods, plans, '2026-02-01')).toBe('active')
    expect(clientStateOn(periods, plans, '2026-04-15')).toBe('inactive')
    expect(clientStateOn(periods, plans, '2026-06-01')).toBe('baja') // el día de la baja ya cuenta como baja
    expect(clientStateOn(periods, plans, '2026-09-10')).toBe('inactive')
    expect(clientStateOn(periods, plans, '2026-10-01')).toBe('active')
  })
  it('hoy en la zona horaria del centro (no en UTC)', () => {
    // 23:30 UTC del 31 de octubre = 00:30 del 1 de noviembre en Madrid (horario de invierno)
    expect(todayIn('Europe/Madrid', new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01')
    expect(ageOn('1990-11-07', '2026-11-06')).toBe(35)
    expect(ageOn('1990-11-06', '2026-11-06')).toBe(36)
  })
})
