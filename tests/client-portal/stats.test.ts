import { describe, expect, it } from 'vitest'
import { computeStreaks, countCompleted } from '@/lib/client-portal/stats'
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

describe('countCompleted', () => {
  it('solo completadas dentro del rango', () => {
    const list = [s('2026-10-31', 'completed'), s('2026-11-02', 'completed'), s('2026-11-03', 'missed'), s('2026-11-09', 'completed')]
    expect(countCompleted(list, '2026-11-01', '2026-11-08')).toBe(1)
  })
})
