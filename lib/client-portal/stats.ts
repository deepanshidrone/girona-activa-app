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

// Sesiones completadas entre dos fechas (incluidas).
export function countCompleted(sessions: S[], from: string, to: string): number {
  return sessions.filter(s => s.status === 'completed' && s.session_date >= from && s.session_date <= to).length
}
