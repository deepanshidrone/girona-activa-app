'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

// Gestión de leads (docs/spec-crm.md §8 y D10). Todas exigen leads.gestionar
// (hoy solo admin). La tabla solo es accesible con service_role.

type Result = { ok: true } | { ok: false; error: string }

const MAX_NOTES = 5000
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)

async function auth() {
  return requirePermission('leads.gestionar')
}

function done(): Result {
  revalidatePath('/dashboard', 'layout') // contador del menú
  return { ok: true }
}

// Al abrir el detalle. Solo marca si no estaba visto (no pisa quién lo vio primero).
export async function markLeadSeenAction(leadId: string): Promise<Result> {
  const a = await auth()
  if (!a.user) return { ok: false, error: a.error }
  if (!isUuid(leadId)) return { ok: false, error: 'Lead no encontrado' }

  const { error } = await createAdminClient()
    .from('leads')
    .update({ seen_at: new Date().toISOString(), seen_by: a.user.id, updated_at: new Date().toISOString() })
    .eq('id', leadId)
    .is('seen_at', null)
  if (error) return { ok: false, error: 'No se ha podido marcar como visto' }
  return done()
}

export async function markAllLeadsSeenAction(): Promise<Result> {
  const a = await auth()
  if (!a.user) return { ok: false, error: a.error }

  const now = new Date().toISOString()
  const { error } = await createAdminClient()
    .from('leads')
    .update({ seen_at: now, seen_by: a.user.id, updated_at: now })
    .is('seen_at', null)
    .eq('is_spam', false)
  if (error) return { ok: false, error: 'No se han podido marcar como vistos' }
  return done()
}

export async function saveLeadNotesAction(leadId: string, notes: string): Promise<Result> {
  const a = await auth()
  if (!a.user) return { ok: false, error: a.error }
  if (!isUuid(leadId)) return { ok: false, error: 'Lead no encontrado' }
  if (typeof notes !== 'string') return { ok: false, error: 'Nota no válida' }

  const clean = notes.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
  if (clean.length > MAX_NOTES) return { ok: false, error: `La nota no puede pasar de ${MAX_NOTES} caracteres` }

  const now = new Date().toISOString()
  const { data, error } = await createAdminClient()
    .from('leads')
    .update({ internal_notes: clean || null, notes_updated_at: now, notes_updated_by: a.user.id, updated_at: now })
    .eq('id', leadId)
    .select('id')
  if (error) return { ok: false, error: 'No se ha podido guardar la nota' }
  if (!data?.length) return { ok: false, error: 'Lead no encontrado' }
  return done()
}

export async function setLeadSpamAction(leadId: string, isSpam: boolean): Promise<Result> {
  const a = await auth()
  if (!a.user) return { ok: false, error: a.error }
  if (!isUuid(leadId) || typeof isSpam !== 'boolean') return { ok: false, error: 'Lead no encontrado' }

  const now = new Date().toISOString()
  const { data, error } = await createAdminClient()
    .from('leads')
    .update({
      is_spam: isSpam,
      spam_marked_at: isSpam ? now : null,
      spam_marked_by: isSpam ? a.user.id : null,
      updated_at: now,
    })
    .eq('id', leadId)
    .select('id')
  if (error) return { ok: false, error: 'No se ha podido cambiar' }
  if (!data?.length) return { ok: false, error: 'Lead no encontrado' }
  return done()
}

// Borrado físico y definitivo (spam o derecho de supresión). Se borra también la nota.
export async function deleteLeadAction(leadId: string): Promise<Result> {
  const a = await auth()
  if (!a.user) return { ok: false, error: a.error }
  if (!isUuid(leadId)) return { ok: false, error: 'Lead no encontrado' }

  const { error } = await createAdminClient().from('leads').delete().eq('id', leadId)
  if (error) return { ok: false, error: 'No se ha podido borrar' }
  console.info('[leads] borrado', leadId, 'por', a.user.id)
  return done()
}
