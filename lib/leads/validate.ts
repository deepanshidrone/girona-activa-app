// Validación del envío de leads, contrato v1 (docs/spec-crm.md §5.2 y §6.2).
//
// Funciones puras (sin BD ni Next) para poder testearlas. El contrato es
// genérico: no hay nada de un centro concreto; las preguntas del formulario y
// los canales llegan como datos.

export type LeadAnswer = { key: string; label: string; value: string }

// Fila lista para insertar en public.leads
export type LeadInsert = {
  source: 'web'
  form_name: string
  external_id: string
  received_at: string
  page_url: string | null
  full_name: string
  email: string | null
  phone: string | null
  phone_normalized: string | null
  channel_key: string | null
  channel_label: string | null
  message: string | null
  answers: LeadAnswer[]
  consent_at: string
  consent_text: string
  privacy_policy_url: string | null
}

export type ParseResult = { ok: true; lead: LeadInsert } | { ok: false; error: string }

const MAX_FUTURE_MS = 5 * 60 * 1000
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_RE = /^[0-9 +\-()]+$/

class Invalid extends Error {}
const fail = (msg: string): never => { throw new Invalid(msg) }

type Obj = Record<string, unknown>

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function onlyKeys(o: Obj, allowed: string[], where: string) {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) fail(`Campo desconocido: ${where}${k}`)
}

// Quita caracteres de control. En los campos de una línea, también los saltos,
// y junta los espacios repetidos.
export function clean(s: string, multiline: boolean): string {
  if (multiline) return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
  return s.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim()
}

function text(v: unknown, field: string, o: { min?: number; max: number; multiline?: boolean; optional?: boolean }): string | null {
  if (v === undefined || v === null) {
    if (o.optional) return null
    fail(`Falta ${field}`)
  }
  if (typeof v !== 'string') fail(`${field} debe ser texto`)
  const s = clean(v as string, o.multiline ?? false)
  if (s === '' && o.optional && (o.min ?? 0) > 0) return null
  if (s.length < (o.min ?? 0)) fail(`${field} vacío`)
  if (s.length > o.max) fail(`${field} demasiado largo`)
  return s
}

function url(v: unknown, field: string, protocols: string[]): string | null {
  const s = text(v, field, { min: 1, max: 500, optional: true })
  if (s === null) return null
  let u: URL
  try { u = new URL(s) } catch { return fail(`${field} no es una URL`) }
  if (!protocols.includes(u.protocol)) fail(`${field}: protocolo no permitido`)
  return s
}

// Teléfono en formato internacional sin "+" (E.164): sirve para detectar
// duplicados y para el enlace de WhatsApp. Si no lleva prefijo (+ o 00), se
// le pone el del país del centro (center_settings.default_country_code).
export function normalizePhone(phone: string, countryCode: string): string | null {
  const trimmed = phone.trim()
  let digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('+')) {
    // ya es internacional
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2)
  } else {
    digits = countryCode + digits
  }
  return /^[0-9]{6,15}$/.test(digits) ? digits : null
}

export function parseLeadPayload(input: unknown, opts: { now: Date; countryCode: string }): ParseResult {
  try {
    return { ok: true, lead: parse(input, opts) }
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message }
    throw e
  }
}

function parse(input: unknown, { now, countryCode }: { now: Date; countryCode: string }): LeadInsert {
  if (!isObj(input)) fail('El cuerpo debe ser un objeto JSON')
  const p = input as Obj
  onlyKeys(p, ['version', 'source', 'form', 'external_id', 'submitted_at', 'page_url',
    'contact', 'channel', 'message', 'answers', 'consent'], '')

  if (p.version !== 1) fail('version no soportada')
  if (p.source !== 'web') fail('source no válido')
  const form_name = text(p.form, 'form', { min: 1, max: 100 })!
  const external_id = text(p.external_id, 'external_id', { min: 1, max: 100 })!

  // Fecha del envío
  if (typeof p.submitted_at !== 'string') fail('Falta submitted_at')
  const submitted = new Date(p.submitted_at as string)
  if (Number.isNaN(submitted.getTime())) fail('submitted_at no es una fecha')
  if (submitted.getTime() - now.getTime() > MAX_FUTURE_MS) fail('submitted_at en el futuro')
  const received_at = submitted.toISOString()

  const page_url = url(p.page_url, 'page_url', ['http:', 'https:'])

  // Contacto
  if (!isObj(p.contact)) fail('Falta contact')
  const c = p.contact as Obj
  onlyKeys(c, ['full_name', 'email', 'phone'], 'contact.')
  const full_name = text(c.full_name, 'contact.full_name', { min: 1, max: 120 })!

  let email = text(c.email, 'contact.email', { min: 1, max: 254, optional: true })
  if (email !== null) {
    email = email.toLowerCase().replace(/\s/g, '')
    if (!EMAIL_RE.test(email)) fail('contact.email no válido')
  }

  const phone = text(c.phone, 'contact.phone', { min: 1, max: 30, optional: true })
  let phone_normalized: string | null = null
  if (phone !== null) {
    if (!PHONE_RE.test(phone)) fail('contact.phone no válido')
    phone_normalized = normalizePhone(phone, countryCode)
    if (phone_normalized === null) fail('contact.phone no válido')
  }
  if (email === null && phone === null) fail('Falta email o teléfono')

  // Canal
  let channel_key: string | null = null
  let channel_label: string | null = null
  if (p.channel !== undefined && p.channel !== null) {
    if (!isObj(p.channel)) fail('channel debe ser un objeto')
    const ch = p.channel as Obj
    onlyKeys(ch, ['key', 'label'], 'channel.')
    channel_key = text(ch.key, 'channel.key', { min: 1, max: 50 })
    channel_label = text(ch.label, 'channel.label', { min: 1, max: 100 })
  }

  const message = text(p.message, 'message', { min: 1, max: 5000, multiline: true, optional: true })

  // Respuestas del formulario, en orden
  const answers: LeadAnswer[] = []
  if (p.answers !== undefined && p.answers !== null) {
    if (!Array.isArray(p.answers)) fail('answers debe ser una lista')
    const list = p.answers as unknown[]
    if (list.length > 30) fail('Demasiadas respuestas')
    list.forEach((a, i) => {
      if (!isObj(a)) fail(`answers[${i}] debe ser un objeto`)
      const ans = a as Obj
      onlyKeys(ans, ['key', 'label', 'value'], `answers[${i}].`)
      answers.push({
        key: text(ans.key, `answers[${i}].key`, { min: 1, max: 50 })!,
        label: text(ans.label, `answers[${i}].label`, { min: 1, max: 200 })!,
        value: text(ans.value, `answers[${i}].value`, { max: 2000, multiline: true })!,
      })
    })
  }

  // Consentimiento: sin él no se guarda el lead
  if (!isObj(p.consent)) fail('Falta consent')
  const cs = p.consent as Obj
  onlyKeys(cs, ['accepted', 'text', 'policy_url'], 'consent.')
  if (cs.accepted !== true) fail('Sin consentimiento')
  const consent_text = text(cs.text, 'consent.text', { min: 1, max: 1000, multiline: true })!
  const privacy_policy_url = url(cs.policy_url, 'consent.policy_url', ['https:'])

  return {
    source: 'web',
    form_name,
    external_id,
    received_at,
    page_url,
    full_name,
    email,
    phone,
    phone_normalized,
    channel_key,
    channel_label,
    message,
    answers,
    consent_at: received_at,
    consent_text,
    privacy_policy_url,
  }
}
