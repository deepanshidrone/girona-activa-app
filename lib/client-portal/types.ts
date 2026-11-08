// Tipos y textos de la vista de cliente (filas de las vistas mi_*).
// Sin 'server-only': también lo usan componentes de cliente.

export type SessionStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled' | 'unrecorded'
export type Difficulty = 'regression' | 'base' | 'progression'
export type SessionSource = 'plan_session' | 'training_session'

export type MiSesion = {
  source: SessionSource
  source_id: string
  session_date: string          // 'YYYY-MM-DD'
  session_time: string | null   // 'HH:MM:SS'
  type: 'individual' | 'group'
  duration_min: number | null
  status: SessionStatus
  session_label: string | null
  difficulty: Difficulty | null
  cycle_id: string | null
  trainer_name: string | null
}

export type MiEjercicio = {
  source: SessionSource
  source_id: string
  planned_id: string
  order_index: number | null
  exercise_id: string
  exercise_name: string
  image_url: string | null
  sets: number | null
  reps: number | null
  weight_kg: number | null
  instructions: string | null
}

export type MiRegistro = {
  id: string
  source: SessionSource
  source_id: string
  date: string
  status: 'in_progress' | 'completed'
  started_at: string | null
  completed_at: string | null
}

export type MiRegistroEjercicio = {
  id: string
  session_log_id: string
  plan_exercise_id: string | null
  exercise_id: string | null
  exercise_name: string | null
  sets_done: number | null
  reps_done: number | null
  load_kg: number | null
  rpe: number | null
  rir: number | null
  skipped: boolean | null
}

export type MiPlan = {
  id: string
  type: 'individual' | 'group'
  level: number | null
  status: string
  start_date: string
  end_date: string | null
  eff_end: string | null
  duration_months: number | null
  weekly_frequency: number | null
  session_duration: number | null
  cycle_id: string | null
  trainer_name: string | null
  is_current: boolean
}

export type ClientState = 'active' | 'inactive' | 'baja'

export type MiFicha = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  sex: string | null
  birth_date: string | null
  height_cm: number | null
  weight_kg: number | null
  start_date: string | null
  state: ClientState
}

export const STATUS_LABEL: Record<SessionStatus, string> = {
  scheduled: 'Prevista',
  completed: 'Completada',
  missed: 'No asistida',
  cancelled: 'Cancelada',
  unrecorded: 'Sin registrar',
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  regression: 'Regresión',
  base: 'Base',
  progression: 'Progresión',
}

// "18:00:00" → "18:00"; con duración, "18:00–19:00".
export function formatTimeRange(time: string | null, durationMin: number | null): string | null {
  if (!time) return null
  const start = time.slice(0, 5)
  if (!durationMin) return start
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + durationMin
  const end = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  return `${start}–${end}`
}

export function sessionTypeLabel(s: Pick<MiSesion, 'type' | 'session_label'>): string {
  if (s.type === 'individual') return 'Individual'
  return s.session_label ? `Grupal · Bloque ${s.session_label}` : 'Grupal'
}

// "3×10 · 15 kg" (lo que falte se omite).
export function formatPrescription(sets: number | null, reps: number | null, kg: number | null): string {
  const parts: string[] = []
  if (sets && reps) parts.push(`${sets}×${reps}`)
  else if (sets) parts.push(`${sets} series`)
  else if (reps) parts.push(`${reps} reps`)
  if (kg) parts.push(`${formatKg(kg)} kg`)
  return parts.join(' · ')
}

// "domingo, 8 de noviembre" → "Domingo, 8 de noviembre" (CSS capitalize pondría "De").
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatKg(kg: number): string {
  return Number(kg).toLocaleString('es-ES', { maximumFractionDigits: 2 })
}
