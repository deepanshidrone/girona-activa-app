import 'server-only'

import type { createAdminClient } from '@/lib/supabase/admin'
import { findDuplicates, type ClientEmail, type DuplicateInfo, type LeadContactKey } from '@/lib/leads/duplicates'
import { leadPeriodRange, LEADS_PER_PAGE, sanitizeSearch, type LeadFilters } from '@/lib/leads/filters'
import type { LeadAnswer } from '@/lib/leads/validate'

// Lectura de leads (docs/spec-crm.md §8). La tabla solo es accesible con
// service_role: quien llame a estas funciones tiene que haber comprobado antes
// requirePermission('leads.gestionar') / hasPermission(..., 'leads.gestionar').

type AdminClient = ReturnType<typeof createAdminClient>

const LIST_COLUMNS =
  'id, received_at, full_name, email, phone, phone_normalized, channel_key, channel_label, answers, seen_at, is_spam, internal_notes'

export type LeadListItem = {
  id: string
  received_at: string
  full_name: string
  email: string | null
  phone: string | null
  phone_normalized: string | null
  channel_key: string | null
  channel_label: string | null
  answers: LeadAnswer[]
  seen_at: string | null
  is_spam: boolean
  internal_notes: string | null
  duplicates: DuplicateInfo
}

export type LeadDetail = LeadListItem & {
  source: string
  form_name: string | null
  page_url: string | null
  message: string | null
  consent_at: string
  consent_text: string
  privacy_policy_url: string | null
  spam_marked_at: string | null
  notes_updated_at: string | null
  seen_by_name: string | null
  spam_marked_by_name: string | null
  notes_updated_by_name: string | null
  other_leads: { id: string; received_at: string; full_name: string }[]
}

export type LeadFilterOptions = {
  channels: { key: string; label: string }[]
  questions: { key: string; label: string; values: string[] }[]
}

// Contador del menú: no vistos y no spam.
export async function countUnseenLeads(admin: AdminClient): Promise<number> {
  const { count } = await admin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .is('seen_at', null)
    .eq('is_spam', false)
  return count ?? 0
}

export async function listLeads(admin: AdminClient, f: LeadFilters, ctx: { today: string; timezone: string }) {
  const { from, to } = leadPeriodRange(f.periodo, ctx.today, ctx.timezone)

  let q = admin.from('leads').select(LIST_COLUMNS, { count: 'exact' }).eq('is_spam', f.spam)
  if (from) q = q.gte('received_at', from)
  if (to) q = q.lt('received_at', to)
  if (f.estado === 'sin_ver') q = q.is('seen_at', null)
  if (f.estado === 'vistos') q = q.not('seen_at', 'is', null)
  if (f.canal) q = q.eq('channel_key', f.canal)
  // answers es jsonb: el filtro va como texto JSON (una lista JS la convertiría en array de Postgres)
  if (f.pregunta && f.valor) q = q.contains('answers', JSON.stringify([{ key: f.pregunta, value: f.valor }]))
  if (f.q) {
    const text = sanitizeSearch(f.q)
    const digits = f.q.replace(/\D/g, '')
    const ors = text ? [`full_name.ilike.*${text}*`, `email.ilike.*${text}*`] : []
    if (digits.length >= 3) ors.push(`phone_normalized.like.*${digits}*`)
    if (ors.length) q = q.or(ors.join(','))
  }

  const start = (f.pagina - 1) * LEADS_PER_PAGE
  const { data, count, error } = await q
    .order('received_at', { ascending: false })
    .range(start, start + LEADS_PER_PAGE - 1)
  if (error) {
    console.error('[leads] listado:', error.code, error.message)
    throw new Error('No se han podido cargar los leads')
  }

  const rows = (data ?? []) as Omit<LeadListItem, 'duplicates'>[]
  const dupes = await loadDuplicateContext(admin, rows)
  return {
    rows: rows.map(r => ({ ...r, duplicates: findDuplicates(r, dupes.related, dupes.clients) })),
    total: count ?? 0,
  }
}

// Opciones de los filtros "Canal" y "Respuesta": lo que ha llegado de verdad
// (no hay catálogo: cada centro tiene su formulario). Se miran los últimos 1.000.
export async function getLeadFilterOptions(admin: AdminClient): Promise<LeadFilterOptions> {
  const { data } = await admin
    .from('leads')
    .select('channel_key, channel_label, answers')
    .order('received_at', { ascending: false })
    .limit(1000)

  const channels = new Map<string, string>()
  const questions = new Map<string, { label: string; values: Set<string> }>()
  for (const r of (data ?? []) as { channel_key: string | null; channel_label: string | null; answers: LeadAnswer[] }[]) {
    if (r.channel_key && !channels.has(r.channel_key)) channels.set(r.channel_key, r.channel_label ?? r.channel_key)
    for (const a of r.answers ?? []) {
      // Solo preguntas de opciones cortas (inversión, horario…), no textos libres
      if (!a.value || a.value.length > 60) continue
      const qq = questions.get(a.key) ?? { label: a.label, values: new Set<string>() }
      qq.values.add(a.value)
      questions.set(a.key, qq)
    }
  }
  return {
    channels: [...channels].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'es')),
    questions: [...questions]
      // Una pregunta con muchos valores distintos es de texto libre; una con solo
      // números (edad) tampoco se filtra por valor exacto
      .filter(([, v]) => v.values.size >= 2 && v.values.size <= 12 && ![...v.values].every(x => /^[\d\s.,]+$/.test(x)))
      .map(([key, v]) => ({ key, label: v.label, values: [...v.values].sort((a, b) => a.localeCompare(b, 'es')) })),
  }
}

export async function getLeadDetail(admin: AdminClient, id: string): Promise<LeadDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await admin
    .from('leads')
    .select(`${LIST_COLUMNS}, source, form_name, page_url, message, consent_at, consent_text, privacy_policy_url,
      spam_marked_at, notes_updated_at, seen_by, spam_marked_by, notes_updated_by`)
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  const lead = data as Omit<LeadDetail, 'duplicates' | 'other_leads' | 'seen_by_name' | 'spam_marked_by_name' | 'notes_updated_by_name'>
    & { seen_by: string | null; spam_marked_by: string | null; notes_updated_by: string | null }

  const dupes = await loadDuplicateContext(admin, [lead])
  const duplicates = findDuplicates(lead, dupes.related, dupes.clients)
  const other_leads = dupes.related
    .filter(r => duplicates.otherLeadIds.includes(r.id))
    .sort((a, b) => b.received_at.localeCompare(a.received_at))
    .map(r => ({ id: r.id, received_at: r.received_at, full_name: r.full_name }))

  const staffIds = [lead.seen_by, lead.spam_marked_by, lead.notes_updated_by].filter((x): x is string => !!x)
  const names = new Map<string, string>()
  if (staffIds.length) {
    const { data: profiles } = await admin.from('profiles').select('id, full_name').in('id', [...new Set(staffIds)])
    for (const p of profiles ?? []) names.set(p.id, p.full_name ?? '—')
  }
  const nameOf = (uid: string | null) => (uid ? names.get(uid) ?? '—' : null)

  const { seen_by, spam_marked_by, notes_updated_by, ...rest } = lead
  return {
    ...rest,
    duplicates,
    other_leads,
    seen_by_name: nameOf(seen_by),
    spam_marked_by_name: nameOf(spam_marked_by),
    notes_updated_by_name: nameOf(notes_updated_by),
  }
}

// Otros leads con el mismo email o teléfono que los de la lista, y fichas de
// cliente con el mismo email. Dos consultas por página, no una por fila.
async function loadDuplicateContext(admin: AdminClient, rows: LeadContactKey[]) {
  const emails = [...new Set(rows.map(r => r.email).filter((e): e is string => !!e))]
  const phones = [...new Set(rows.map(r => r.phone_normalized).filter((p): p is string => !!p))]

  const related: (LeadContactKey & { received_at: string; full_name: string })[] = []
  if (emails.length || phones.length) {
    const ors = [
      ...(emails.length ? [`email.in.(${emails.map(quote).join(',')})`] : []),
      ...(phones.length ? [`phone_normalized.in.(${phones.join(',')})`] : []),
    ]
    const { data } = await admin
      .from('leads')
      .select('id, email, phone_normalized, received_at, full_name')
      .eq('is_spam', false)
      .or(ors.join(','))
      .limit(1000)
    related.push(...((data ?? []) as typeof related))
  }

  let clients: ClientEmail[] = []
  if (emails.length) {
    // clients.email puede tener mayúsculas: se compara en minúsculas en findDuplicates
    const { data } = await admin
      .from('clients')
      .select('id, email, first_name, last_name')
      .or(emails.map(e => `email.ilike.${quote(e)}`).join(','))
    clients = (data ?? []) as ClientEmail[]
  }
  return { related, clients }
}

// Valor entre comillas para filtros de PostgREST. Los emails ya están validados
// al entrar (sin comillas ni espacios); se escapan por si acaso.
function quote(v: string): string {
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
