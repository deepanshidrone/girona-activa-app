import { describe, expect, it } from 'vitest'
import { completedByMonth, computeAdherence, computeStreaks, countCompleted } from '@/lib/client-portal/stats'
import type { SessionStatus } from '@/lib/client-portal/types'

const s = (session_date: string, status: SessionStatus, session_time: string | null = '18:00:00') =>
  ({ session_date, session_time, status })

describe('computeStreaks (D3)', () => {
  it('cuenta las completadas seguidas hasta hoy', () => {
    const r = computeStreaks([s('2026-11-02', 'completed'), s('2026-11-04', 'completed'), s('2026-11-06', 'completed')], '2026-11-08')
    expect(r).toEqual({ current: 3, max: 3 })
  })

  it('una no asistida corta la racha, pero se guarda la máxima', () => {
    const r = computeStreaks([
      s('2026-10-01', 'completed'), s('2026-10-03', 'completed'), s('2026-10-06', 'completed'),
      s('2026-10-08', 'missed'),
      s('2026-10-10', 'completed'),
    ], '2026-11-08')
    expect(r).toEqual({ current: 1, max: 3 })
  })

  it('canceladas y grupales sin registrar no la rompen', () => {
    const r = computeStreaks([
      s('2026-11-02', 'completed'), s('2026-11-03', 'cancelled'), s('2026-11-04', 'unrecorded'), s('2026-11-05', 'completed'),
    ], '2026-11-08')
    expect(r.current).toBe(2)
  })

  it('las de hoy previstas y las futuras no cuentan', () => {
    const r = computeStreaks([s('2026-11-06', 'completed'), s('2026-11-08', 'scheduled'), s('2026-11-11', 'scheduled')], '2026-11-08')
    expect(r).toEqual({ current: 1, max: 1 })
  })

  it('ordena por fecha y hora aunque lleguen desordenadas', () => {
    const r = computeStreaks([
      s('2026-11-05', 'completed', '19:00:00'), s('2026-11-05', 'missed', '09:00:00'), s('2026-11-02', 'completed'),
    ], '2026-11-08')
    expect(r).toEqual({ current: 1, max: 1 })
  })

  it('sin sesiones, 0', () => {
    expect(computeStreaks([], '2026-11-08')).toEqual({ current: 0, max: 0 })
  })
})

describe('computeAdherence (D6)', () => {
  const list = [
    s('2026-10-26', 'completed'),              // antes del plan
    s('2026-11-02', 'missed'),
    s('2026-11-04', 'completed'),
    s('2026-11-05', 'cancelled'),              // no cuenta
    s('2026-11-06', 'unrecorded'),             // no cuenta
    s('2026-11-08', 'scheduled'),              // hoy, todavía prevista
    s('2026-11-11', 'scheduled'),              // futura
  ]
  it('completadas ÷ (completadas + no asistidas) dentro del plan y hasta hoy', () => {
    expect(computeAdherence(list, '2026-11-08', '2026-11-01', '2027-01-31')).toEqual({ pct: 50, completed: 1, missed: 1 })
  })
  it('sin ventana, todo el historial', () => {
    expect(computeAdherence(list, '2026-11-08')).toEqual({ pct: 67, completed: 2, missed: 1 })
  })
  it('respeta el fin efectivo del plan si es anterior a hoy', () => {
    expect(computeAdherence(list, '2026-11-08', '2026-10-01', '2026-11-03')).toEqual({ pct: 50, completed: 1, missed: 1 })
  })
  it('sin sesiones que cuenten → null (sin datos), no 0 %', () => {
    expect(computeAdherence([s('2026-11-11', 'scheduled')], '2026-11-08').pct).toBeNull()
  })
})

describe('completedByMonth', () => {
  it('últimos meses del más antiguo al actual, con ceros', () => {
    const r = completedByMonth([
      s('2026-09-15', 'completed'), s('2026-11-02', 'completed'), s('2026-11-03', 'missed'),
      s('2026-11-20', 'completed'),            // futura respecto a hoy: no cuenta
      s('2026-04-01', 'completed'),            // fuera de la ventana
    ], '2026-11-08', 3)
    expect(r).toEqual([
      { month: '2026-09', completed: 1 }, { month: '2026-10', completed: 0 }, { month: '2026-11', completed: 1 },
    ])
  })
  it('cruza el cambio de año', () => {
    expect(completedByMonth([], '2027-01-10', 3).map(r => r.month)).toEqual(['2026-11', '2026-12', '2027-01'])
  })
})

describe('countCompleted', () => {
  it('solo completadas dentro del rango', () => {
    const list = [s('2026-10-31', 'completed'), s('2026-11-02', 'completed'), s('2026-11-03', 'missed'), s('2026-11-09', 'completed')]
    expect(countCompleted(list, '2026-11-01', '2026-11-08')).toBe(1)
  })
})
