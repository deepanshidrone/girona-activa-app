// Reglas del feedback del cliente (docs/spec-vista-cliente.md §4.1.3).
// Sin 'server-only': las usan la Server Action, las páginas y los tests.
import { addDays } from '@/lib/center'
import type { MiSesion } from './types'

export const FEEDBACK_WINDOW_DAYS = 7
export const PAIN_AREA_MAX = 200
export const COMMENT_MAX = 1000

export type MiFeedback = {
  id: string
  target_type: 'plan_session' | 'training_session'
  target_id: string
  pain: boolean
  pain_area: string | null
  comment: string | null
  created_at: string
  updated_at: string
  read_by_staff: boolean
}

type S = Pick<MiSesion, 'session_date' | 'status'>

// ¿Se puede dejar o editar feedback de esta sesión hoy?
// - Desde el día de la sesión hasta 7 días después (incluido).
// - No en sesiones canceladas ni en las que consta que no asistió.
export function feedbackWindow(s: S, today: string): { open: boolean; until: string; reason?: string } {
  const until = addDays(s.session_date, FEEDBACK_WINDOW_DAYS)
  if (s.status === 'cancelled') return { open: false, until, reason: 'La sesión se canceló.' }
  if (s.status === 'missed') return { open: false, until, reason: 'Esta sesión consta como no asistida.' }
  if (s.session_date > today) return { open: false, until, reason: 'Podrás contar cómo fue a partir del día de la sesión.' }
  if (today > until) return { open: false, until, reason: 'El plazo para contar cómo fue ya ha pasado.' }
  return { open: true, until }
}

// Sesión más reciente completada en los últimos 7 días que aún no tiene
// feedback (para la tarjeta "¿Qué tal fue…?" de Hoy).
export function pendingFeedbackSession<T extends S & { source_id: string; session_time?: string | null }>(
  sesiones: T[], feedbackTargets: Set<string>, today: string,
): T | null {
  const candidatas = sesiones.filter(s =>
    s.status === 'completed' && !feedbackTargets.has(s.source_id) && feedbackWindow(s, today).open)
  candidatas.sort((a, b) =>
    b.session_date.localeCompare(a.session_date) || (b.session_time ?? '').localeCompare(a.session_time ?? ''))
  return candidatas[0] ?? null
}

// Normaliza y valida lo que envía el formulario. Devuelve error o los datos limpios.
export function parseFeedbackInput(input: { pain: unknown; painArea?: unknown; comment?: unknown }):
  { error: string } | { pain: boolean; pain_area: string | null; comment: string | null } {
  if (typeof input.pain !== 'boolean') return { error: 'Indica si has tenido dolor.' }
  const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  const painArea = input.pain ? clean(input.painArea) : ''
  const comment = clean(input.comment)
  if (painArea.length > PAIN_AREA_MAX) return { error: `La zona del dolor admite como mucho ${PAIN_AREA_MAX} caracteres.` }
  if (comment.length > COMMENT_MAX) return { error: `El comentario admite como mucho ${COMMENT_MAX} caracteres.` }
  return { pain: input.pain, pain_area: painArea || null, comment: comment || null }
}
