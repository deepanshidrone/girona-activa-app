import { describe, expect, it } from 'vitest'
import { completedByMonth, computeAdherence, computeStreaks, countCompleted } from '@/lib/client-portal/stats'
import type { SessionStatus } from '@/lib/client-portal/types'
import { feedbackWindow, parseFeedbackInput, pendingFeedbackSession } from '@/lib/client-portal/feedback'
import { computePain } from '@/lib/kpis/compute'

describe('computePain (KPI dolor reportado)', () => {
  const rows = [
    { session_date: '2026-11-02', employee_id: 'e1', plan_type: 'individual', pain: true },
    { session_date: '2026-11-06', employee_id: 'e1', plan_type: 'group', pain: false },
    { session_date: '2026-11-07', employee_id: 'e2', plan_type: 'group', pain: false },
    { session_date: '2026-10-15', employee_id: 'e1', plan_type: 'individual', pain: true },
  ]
  it('% de sesiones con feedback que marcan dolor, por mes de la sesión', () => {
    const r = computePain(rows, ['2026-11-01'], { employee: 'all', type: 'all' })
    expect(r.total).toBe(3)
    expect(r.withPain).toBe(1)
    expect(r.pct).toBeCloseTo(33.33, 1)
  })
  it('respeta los filtros de entrenador y tipo', () => {
    expect(computePain(rows, ['2026-11-01'], { employee: 'e1', type: 'all' })).toEqual({ pct: 50, withPain: 1, total: 2 })
    expect(computePain(rows, ['2026-11-01'], { employee: 'all', type: 'group' }).pct).toBe(0)
  })
  it('sin feedback en el periodo → null (sin datos)', () => {
    expect(computePain(rows, ['2026-09-01'], { employee: 'all', type: 'all' }).pct).toBeNull()
  })
})

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

describe('feedbackWindow', () => {
  it('abierto desde el día de la sesión hasta 7 días después', () => {
    expect(feedbackWindow(s('2026-11-06', 'completed'), '2026-11-06').open).toBe(true)
    expect(feedbackWindow(s('2026-11-06', 'completed'), '2026-11-13')).toEqual({ open: true, until: '2026-11-13' })
    expect(feedbackWindow(s('2026-11-06', 'completed'), '2026-11-14').open).toBe(false)
  })
  it('cerrado en futuras, canceladas y no asistidas; abierto en grupales sin registrar', () => {
    expect(feedbackWindow(s('2026-11-11', 'scheduled'), '2026-11-08').open).toBe(false)
    expect(feedbackWindow(s('2026-11-06', 'cancelled'), '2026-11-08').open).toBe(false)
    expect(feedbackWindow(s('2026-11-06', 'missed'), '2026-11-08').open).toBe(false)
    expect(feedbackWindow(s('2026-11-06', 'unrecorded'), '2026-11-08').open).toBe(true)
    expect(feedbackWindow(s('2026-11-08', 'scheduled'), '2026-11-08').open).toBe(true)
  })
})

describe('pendingFeedbackSession', () => {
  const list = [
    { ...s('2026-10-20', 'completed'), source_id: 'vieja' },     // fuera de plazo
    { ...s('2026-11-04', 'completed'), source_id: 'a' },
    { ...s('2026-11-06', 'completed'), source_id: 'b' },
    { ...s('2026-11-07', 'missed'), source_id: 'c' },
  ]
  it('la completada más reciente sin feedback y dentro de plazo', () => {
    expect(pendingFeedbackSession(list, new Set(), '2026-11-08')?.source_id).toBe('b')
    expect(pendingFeedbackSession(list, new Set(['b']), '2026-11-08')?.source_id).toBe('a')
    expect(pendingFeedbackSession(list, new Set(['a', 'b']), '2026-11-08')).toBeNull()
  })
})

describe('parseFeedbackInput', () => {
  it('exige indicar dolor sí/no', () => {
    expect(parseFeedbackInput({ pain: undefined })).toEqual({ error: 'Indica si has tenido dolor.' })
  })
  it('limpia textos y descarta la zona si no hay dolor', () => {
    expect(parseFeedbackInput({ pain: false, painArea: 'rodilla', comment: '  bien  ' }))
      .toEqual({ pain: false, pain_area: null, comment: 'bien' })
    expect(parseFeedbackInput({ pain: true, painArea: ' rodilla ', comment: '' }))
      .toEqual({ pain: true, pain_area: 'rodilla', comment: null })
  })
  it('rechaza textos demasiado largos', () => {
    expect('error' in parseFeedbackInput({ pain: false, comment: 'x'.repeat(1001) })).toBe(true)
  })
})

describe('countCompleted', () => {
  it('solo completadas dentro del rango', () => {
    const list = [s('2026-10-31', 'completed'), s('2026-11-02', 'completed'), s('2026-11-03', 'missed'), s('2026-11-09', 'completed')]
    expect(countCompleted(list, '2026-11-01', '2026-11-08')).toBe(1)
  })
})
