// Alta manual de un lead desde el dashboard (docs/spec-crm.md §16). Funciones
// puras para poder testearlas. Las mismas reglas que el contrato v1 de la web,
// pero con un error por campo para mostrarlo junto a cada uno en el formulario.

import { clean, EMAIL_RE, normalizePhone, PHONE_RE, type LeadAnswer } from '@/lib/leads/validate'
import { isLeadStatus, type LeadStatus } from '@/lib/leads/status'

// Preguntas y canales que han llegado por la web (lib/leads/data.ts, getLeadFormCatalog)
export type LeadFormQuestion = { key: string; label: string; suggestions: string[]; long: boolean }
export type LeadFormCatalog = {
  questions: LeadFormQuestion[]
  channels: { key: string; label: string }[]
  policyUrl: string | null
}

// Texto de la casilla; se guarda tal cual en consent_text (M2)
export const MANUAL_CONSENT_TEXT =
  'El centro ha informado a la persona de la política de privacidad y acepta que la contacten.'

export const MANUAL_LIMITS = { name: 120, email: 254, phone: 30, answer: 2000, notes: 5000 } as const

export type ManualLeadInsert = {
  source: 'manual'
  received_at: string
  full_name: string
  email: string | null
  phone: string | null
  phone_normalized: string | null
  channel_key: string | null
  channel_label: string | null
  answers: LeadAnswer[]
  consent_at: string
  consent_text: string
  privacy_policy_url: string | null
  status: LeadStatus
}

export type ManualLeadFields = {
  full_name?: string
  email?: string
  phone?: string
  channel_key?: string
  status?: string
  notes?: string
  consent?: boolean
  answers?: Record<string, string> // por key de pregunta
}

export type ManualLeadErrors = Partial<Record<'full_name' | 'email' | 'phone' | 'channel_key' | 'status' | 'notes' | 'consent' | 'form', string>>
  & { answers?: Record<string, string> }

// Estado del formulario de alta (useActionState con createLeadAction)
// `values` devuelve lo escrito cuando hay errores; `attempt` cambia en cada envío.
export type CreateLeadState = { errors?: ManualLeadErrors; values?: ManualLeadFields; attempt?: number }

export type ManualParseResult =
  | { ok: true; lead: ManualLeadInsert; notes: string | null }
  | { ok: false; errors: ManualLeadErrors }

export function parseManualLead(
  f: ManualLeadFields,
  catalog: LeadFormCatalog,
  { now, countryCode }: { now: Date; countryCode: string },
): ManualParseResult {
  const errors: ManualLeadErrors = {}
  const line = (v: string | undefined) => clean(v ?? '', false)

  const full_name = line(f.full_name)
  if (!full_name) errors.full_name = 'Escribe el nombre'
  else if (full_name.length > MANUAL_LIMITS.name) errors.full_name = `Como mucho ${MANUAL_LIMITS.name} caracteres`

  const email: string | null = line(f.email).toLowerCase().replace(/\s/g, '') || null
  if (email && (email.length > MANUAL_LIMITS.email || !EMAIL_RE.test(email))) errors.email = 'El email no es válido'

  const phone = line(f.phone) || null
  let phone_normalized: string | null = null
  if (phone) {
    phone_normalized = phone.length <= MANUAL_LIMITS.phone && PHONE_RE.test(phone) ? normalizePhone(phone, countryCode) : null
    if (!phone_normalized) errors.phone = 'El teléfono no es válido (solo números, espacios, +, guiones y paréntesis)'
  }
  if (!email && !phone && !errors.email && !errors.phone) {
    errors.phone = 'Hace falta un teléfono o un email'
  }

  // Canal: solo uno de los que han llegado por la web (M5). La etiqueta sale del catálogo.
  let channel_key: string | null = null
  let channel_label: string | null = null
  const ck = line(f.channel_key)
  if (ck) {
    const ch = catalog.channels.find(c => c.key === ck)
    if (!ch) errors.channel_key = 'Canal no válido'
    else { channel_key = ch.key; channel_label = ch.label }
  }

  const statusIn = line(f.status) || 'nuevo'
  if (!isLeadStatus(statusIn)) errors.status = 'Estado no válido'
  const status = (isLeadStatus(statusIn) ? statusIn : 'nuevo') as LeadStatus

  // Respuestas: solo las preguntas del catálogo, en su orden, con su etiqueta (M3, M4)
  const answers: LeadAnswer[] = []
  for (const q of catalog.questions) {
    const value = clean(f.answers?.[q.key] ?? '', true)
    if (!value) continue
    if (value.length > MANUAL_LIMITS.answer) {
      errors.answers = { ...errors.answers, [q.key]: `Como mucho ${MANUAL_LIMITS.answer} caracteres` }
      continue
    }
    answers.push({ key: q.key, label: q.label, value })
  }

  const notes = clean(f.notes ?? '', true) || null
  if (notes && notes.length > MANUAL_LIMITS.notes) errors.notes = `Como mucho ${MANUAL_LIMITS.notes} caracteres`

  if (f.consent !== true) errors.consent = 'Sin el consentimiento no se puede guardar'

  if (Object.keys(errors).length) return { ok: false, errors }

  const at = now.toISOString()
  return {
    ok: true,
    notes,
    lead: {
      source: 'manual',
      received_at: at,
      full_name,
      email,
      phone,
      phone_normalized,
      channel_key,
      channel_label,
      answers,
      consent_at: at,
      consent_text: MANUAL_CONSENT_TEXT,
      privacy_policy_url: catalog.policyUrl,
      status,
    },
  }
}

// Catálogo a partir de los leads web más recientes (de más nuevo a más viejo).
// Preguntas en el orden del lead más reciente que las tiene; las que solo salen
// en leads más viejos van detrás. Sugerencias si hay como mucho 12 valores
// distintos y todos cortos (§16.3).
export function buildLeadFormCatalog(
  rows: { channel_key: string | null; channel_label: string | null; answers: LeadAnswer[] | null; privacy_policy_url: string | null }[],
): LeadFormCatalog {
  const order: string[] = []
  const questions = new Map<string, { label: string; values: Set<string>; long: boolean }>()
  const channels = new Map<string, string>()
  let policyUrl: string | null = null

  for (const r of rows) {
    if (!policyUrl && r.privacy_policy_url) policyUrl = r.privacy_policy_url
    if (r.channel_key && !channels.has(r.channel_key)) channels.set(r.channel_key, r.channel_label ?? r.channel_key)
    for (const a of r.answers ?? []) {
      let q = questions.get(a.key)
      if (!q) {
        q = { label: a.label, values: new Set(), long: false }
        questions.set(a.key, q)
        order.push(a.key)
      }
      if (!a.value) continue
      if (a.value.length > 60 || a.value.includes('\n')) q.long = true
      q.values.add(a.value)
    }
  }

  return {
    questions: order.map(key => {
      const q = questions.get(key)!
      const suggest = !q.long && q.values.size <= 12
      return {
        key,
        label: q.label,
        long: q.long,
        suggestions: suggest ? [...q.values].sort((a, b) => a.localeCompare(b, 'es')) : [],
      }
    }),
    channels: [...channels].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'es')),
    policyUrl,
  }
}
