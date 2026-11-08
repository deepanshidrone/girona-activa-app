// Cálculos de la vista de cliente (docs/spec-vista-cliente.md D3 y D6).
import type { MiSesion } from './types'

type S = Pick<MiSesion, 'session_date' | 'session_time' | 'status'>

const byDateTime = (a: S, b: S) =>
  a.session_date.localeCompare(b.session_date) || (a.session_time ?? '').localeCompare(b.session_time ?? '')

// Racha (D3): sesiones programadas consecutivas a las que el cliente asistió.
// - Solo cuentan las sesiones hasta hoy con estado completed o missed.
// - No la rompen: festivos y fines de semana (no hay sesión), sesiones
//   canceladas, grupales sin registrar (asistencia no tomada) ni las de hoy
//   todavía previstas.
export function computeStreaks(sessions: S[], today: string): { current: number; max: number } {
  let run = 0
  let max = 0
  for (const s of [...sessions].sort(byDateTime)) {
    if (s.session_date > today) break
    if (s.status === 'completed') {
      run++
      if (run > max) max = run
    } else if (s.status === 'missed') {
      run = 0
    }
  }
  return { current: run, max }
}

// Adherencia (D6, misma definición que los KPIs, docs/spec-kpis.md §5.3):
// completadas ÷ (completadas + no asistidas), solo sesiones hasta hoy y dentro
// de [from, to]. Las canceladas y las grupales sin registrar no cuentan.
// pct = null cuando no hay datos (se muestra "sin datos", no 0 %).
export function computeAdherence(
  sessions: S[], today: string, from?: string | null, to?: string | null,
): { pct: number | null; completed: number; missed: number } {
  const end = to && to < today ? to : today
  let completed = 0
  let missed = 0
  for (const s of sessions) {
    if (s.session_date > end || (from && s.session_date < from)) continue
    if (s.status === 'completed') completed++
    else if (s.status === 'missed') missed++
  }
  const total = completed + missed
  return { pct: total ? Math.round((completed / total) * 100) : null, completed, missed }
}

// Sesiones completadas por mes en los últimos `months` meses (incluido el actual),
// del más antiguo al más reciente. month = 'YYYY-MM'.
export function completedByMonth(sessions: S[], today: string, months = 6): { month: string; completed: number }[] {
  const [y, m] = today.split('-').map(Number)
  const result: { month: string; completed: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    result.push({ month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, completed: 0 })
  }
  const index = new Map(result.map((r, i) => [r.month, i]))
  for (const s of sessions) {
    if (s.status !== 'completed' || s.session_date > today) continue
    const i = index.get(s.session_date.slice(0, 7))
    if (i !== undefined) result[i].completed++
  }
  return result
}

// Sesiones completadas entre dos fechas (incluidas).
export function countCompleted(sessions: S[], from: string, to: string): number {
  return sessions.filter(s => s.status === 'completed' && s.session_date >= from && s.session_date <= to).length
}
