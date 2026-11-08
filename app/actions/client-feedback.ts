'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireClient, requireStaff } from '@/lib/auth/permissions'
import { getPortal, getSesion } from '@/lib/client-portal/data'
import { feedbackWindow, parseFeedbackInput } from '@/lib/client-portal/feedback'

// Feedback del cliente tras una sesión (docs/spec-vista-cliente.md §4.1.3 y §4.2).

// ---------------------------------------------------------------------------
// Cliente

// Crea o edita el feedback de una sesión propia.
// - El clientId sale de la sesión (requireClient), nunca del formulario.
// - La sesión se busca en mi_sesiones con la sesión del cliente: si no es suya, no existe.
// - Plazo: desde el día de la sesión hasta 7 días después; no en canceladas ni no asistidas.
// - Un cliente de baja no puede dejar feedback nuevo (P9).
// - Al editar, vuelve a quedar "sin leer" para el entrenador.
export async function submitSessionFeedbackAction(input: {
  sourceId: string
  pain: boolean
  painArea?: string
  comment?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireClient()
  if (!auth.user) return { ok: false, error: auth.error }

  const portal = await getPortal()
  if (!portal?.ficha) return { ok: false, error: 'No autorizado' }
  if (portal.ficha.state === 'baja') {
    return { ok: false, error: 'No tienes un plan activo. Habla con tu centro.' }
  }

  const sesion = typeof input?.sourceId === 'string' ? await getSesion(input.sourceId) : null
  if (!sesion) return { ok: false, error: 'Sesión no encontrada' }

  const plazo = feedbackWindow(sesion, portal.today)
  if (!plazo.open) return { ok: false, error: plazo.reason ?? 'No se puede enviar feedback de esta sesión.' }

  const parsed = parseFeedbackInput(input)
  if ('error' in parsed) return { ok: false, error: parsed.error }

  const admin = createAdminClient()
  const { error } = await admin.from('client_feedback').upsert({
    client_id: auth.user.clientId,
    target_type: sesion.source,
    target_id: sesion.source_id,
    kind: 'feedback',
    ...parsed,
    updated_at: new Date().toISOString(),
    read_at: null,
    read_by: null,
  }, { onConflict: 'client_id,target_type,target_id,kind' })

  if (error) {
    console.error('client_feedback upsert:', error)
    return { ok: false, error: 'No se ha podido guardar. Inténtalo de nuevo.' }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Personal

export type StaffFeedback = {
  id: string
  client_id: string
  client_name: string
  pain: boolean
  pain_area: string | null
  comment: string | null
  created_at: string
  updated_at: string
  read_at: string | null
  session_date: string | null
  session_label: string
}

type FeedbackRow = {
  id: string; client_id: string; target_type: string; target_id: string; pain: boolean
  pain_area: string | null; comment: string | null; created_at: string; updated_at: string; read_at: string | null
}

// Añade a cada feedback la fecha y el tipo de su sesión, y el nombre del cliente.
async function enrich(admin: ReturnType<typeof createAdminClient>, rows: FeedbackRow[]): Promise<StaffFeedback[]> {
  const planIds = rows.filter(r => r.target_type === 'plan_session').map(r => r.target_id)
  const tsIds = rows.filter(r => r.target_type === 'training_session').map(r => r.target_id)
  const clientIds = [...new Set(rows.map(r => r.client_id))]

  const [plan, ts, clients] = await Promise.all([
    planIds.length
      ? admin.from('plan_sessions').select('id, session_date, session_label, training_plans(type)').in('id', planIds)
      : Promise.resolve({ data: [] as { id: string; session_date: string; session_label: string | null; training_plans: unknown }[] }),
    tsIds.length
      ? admin.from('training_sessions').select('id, session_date, session_label').in('id', tsIds)
      : Promise.resolve({ data: [] as { id: string; session_date: string; session_label: string | null }[] }),
    clientIds.length
      ? admin.from('clients').select('id, first_name, last_name').in('id', clientIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
  ])

  const info = new Map<string, { date: string; label: string }>()
  for (const p of plan.data ?? []) {
    const rel = p.training_plans as { type: string } | { type: string }[] | null
    const type = (Array.isArray(rel) ? rel[0] : rel)?.type
    info.set(p.id, { date: p.session_date, label: type === 'group' ? `Grupal${p.session_label ? ' · ' + p.session_label : ''}` : 'Individual' })
  }
  for (const t of ts.data ?? []) {
    info.set(t.id, { date: t.session_date, label: `Grupal${t.session_label ? ' · ' + t.session_label : ''}` })
  }
  const names = new Map((clients.data ?? []).map(c => [c.id, `${c.first_name} ${c.last_name}`]))

  return rows.map(r => ({
    id: r.id,
    client_id: r.client_id,
    client_name: names.get(r.client_id) ?? 'Cliente',
    pain: r.pain,
    pain_area: r.pain_area,
    comment: r.comment,
    created_at: r.created_at,
    updated_at: r.updated_at,
    read_at: r.read_at,
    session_date: info.get(r.target_id)?.date ?? null,
    session_label: info.get(r.target_id)?.label ?? 'Sesión',
  }))
}

const COLUMNS = 'id, client_id, target_type, target_id, pain, pain_area, comment, created_at, updated_at, read_at'

// Feedback de un cliente (ficha), del más reciente al más antiguo.
export async function getClientFeedbackAction(clientId: string, limit = 20): Promise<StaffFeedback[]> {
  const auth = await requireStaff()
  if (!auth.user) return []
  const admin = createAdminClient()
  const { data } = await admin.from('client_feedback').select(COLUMNS)
    .eq('client_id', clientId).order('updated_at', { ascending: false }).limit(limit)
  return enrich(admin, (data ?? []) as FeedbackRow[])
}

// Feedback sin leer de todos los clientes (agenda "Hoy"): primero los de dolor.
export async function getUnreadFeedbackAction(limit = 30): Promise<StaffFeedback[]> {
  const auth = await requireStaff()
  if (!auth.user) return []
  const admin = createAdminClient()
  const { data } = await admin.from('client_feedback').select(COLUMNS)
    .is('read_at', null).order('pain', { ascending: false }).order('updated_at', { ascending: false }).limit(limit)
  return enrich(admin, (data ?? []) as FeedbackRow[])
}

// Marca como leído todo el feedback pendiente de un cliente.
export async function markClientFeedbackReadAction(clientId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await requireStaff()
  if (!auth.user) return { ok: false, error: auth.error }
  const admin = createAdminClient()
  const { error } = await admin.from('client_feedback')
    .update({ read_at: new Date().toISOString(), read_by: auth.user.id })
    .eq('client_id', clientId).is('read_at', null)
  if (error) return { ok: false, error: 'No se ha podido marcar como leído.' }
  return { ok: true }
}
