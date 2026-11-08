import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signLeadPayload, verifyLeadSignature } from '@/lib/leads/signature'
import { normalizePhone, parseLeadPayload } from '@/lib/leads/validate'

const SECRET = 'a'.repeat(40)
const OLD_SECRET = 'b'.repeat(40)
const NOW = new Date('2026-11-08T12:00:00Z')
const NOW_S = Math.floor(NOW.getTime() / 1000)

function payload(over: Record<string, unknown> = {}) {
  return {
    version: 1,
    source: 'web',
    form: 'contacte',
    external_id: 'sub-1',
    submitted_at: '2026-11-08T11:59:00Z',
    page_url: 'https://centro.example/',
    contact: { full_name: 'Anna Puig', email: 'Anna@Example.com ', phone: '639 58 27 57' },
    channel: { key: 'instagram', label: 'Instagram' },
    message: null,
    answers: [
      { key: 'edat', label: 'Edat', value: '35' },
      { key: 'objectiu', label: 'Objectiu', value: 'Línia 1\nLínia 2' },
    ],
    consent: { accepted: true, text: 'Accepto la política', policy_url: 'https://centro.example/privacitat.html' },
    ...over,
  }
}

const parse = (p: unknown) => parseLeadPayload(p, { now: NOW, countryCode: '34' })

// ---------------------------------------------------------------------------
describe('firma HMAC', () => {
  const body = '{"a":1}'
  const ts = String(NOW_S)
  const sig = signLeadPayload(SECRET, ts, body)
  const verify = (o: Partial<Parameters<typeof verifyLeadSignature>[0]>) =>
    verifyLeadSignature({ secrets: [SECRET], timestamp: ts, signature: sig, body, nowSeconds: NOW_S, ...o })

  it('acepta una firma correcta', () => expect(verify({})).toBe(true))
  it('acepta el secreto anterior durante el cambio', () => {
    const s = signLeadPayload(OLD_SECRET, ts, body)
    expect(verify({ secrets: [SECRET, OLD_SECRET], signature: s })).toBe(true)
  })
  it('rechaza otro secreto', () => expect(verify({ secrets: [OLD_SECRET] })).toBe(false))
  it('rechaza el cuerpo alterado', () => expect(verify({ body: '{"a":2}' })).toBe(false))
  it('rechaza la hora alterada', () => expect(verify({ timestamp: String(NOW_S + 1) })).toBe(false))
  it('rechaza firmas de hace más de 5 minutos', () => expect(verify({ nowSeconds: NOW_S + 301 })).toBe(false))
  it('acepta dentro de los 5 minutos', () => expect(verify({ nowSeconds: NOW_S + 299 })).toBe(true))
  it('rechaza cabeceras ausentes o mal formadas', () => {
    expect(verify({ signature: null })).toBe(false)
    expect(verify({ timestamp: null })).toBe(false)
    expect(verify({ signature: 'sha256=xyz' })).toBe(false)
    expect(verify({ timestamp: 'abc' })).toBe(false)
  })
  it('sin secretos no acepta nada', () => expect(verify({ secrets: [] })).toBe(false))
})

// ---------------------------------------------------------------------------
describe('normalizePhone', () => {
  it('nacional → con el prefijo del centro', () => expect(normalizePhone('639 58 27 57', '34')).toBe('34639582757'))
  it('con + se respeta', () => expect(normalizePhone('+34 639-58-27-57', '34')).toBe('34639582757'))
  it('con 00 se quita el 00', () => expect(normalizePhone('0033 6 12 34 56 78', '34')).toBe('33612345678'))
  it('demasiado corto → null', () => expect(normalizePhone('12', '34')).toBeNull())
})

// ---------------------------------------------------------------------------
describe('parseLeadPayload', () => {
  it('convierte un envío válido en una fila de leads', () => {
    const r = parse(payload())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lead).toMatchObject({
      source: 'web',
      form_name: 'contacte',
      external_id: 'sub-1',
      received_at: '2026-11-08T11:59:00.000Z',
      consent_at: '2026-11-08T11:59:00.000Z',
      full_name: 'Anna Puig',
      email: 'anna@example.com',
      phone: '639 58 27 57',
      phone_normalized: '34639582757',
      channel_key: 'instagram',
      channel_label: 'Instagram',
      message: null,
    })
    expect(r.lead.answers).toEqual([
      { key: 'edat', label: 'Edat', value: '35' },
      { key: 'objectiu', label: 'Objectiu', value: 'Línia 1\nLínia 2' },
    ])
  })

  it('basta con email o con teléfono', () => {
    expect(parse(payload({ contact: { full_name: 'A', email: 'a@b.co' } })).ok).toBe(true)
    expect(parse(payload({ contact: { full_name: 'A', phone: '612345678' } })).ok).toBe(true)
  })

  it('quita caracteres de control y saltos en campos de una línea', () => {
    const r = parse(payload({ contact: { full_name: ' Anna\u0000\nPuig ', phone: '612345678' } }))
    expect(r.ok && r.lead.full_name).toBe('Anna Puig')
  })

  const rechazos: [string, unknown][] = [
    ['sin consentimiento', payload({ consent: { accepted: false, text: 'x' } })],
    ['consentimiento ausente', payload({ consent: undefined })],
    ['sin email ni teléfono', payload({ contact: { full_name: 'A' } })],
    ['email no válido', payload({ contact: { full_name: 'A', email: 'no-es-email' } })],
    ['teléfono con letras', payload({ contact: { full_name: 'A', phone: '612abc678' } })],
    ['nombre vacío', payload({ contact: { full_name: '   ', email: 'a@b.co' } })],
    ['nombre demasiado largo', payload({ contact: { full_name: 'x'.repeat(121), email: 'a@b.co' } })],
    ['campo desconocido en la raíz', payload({ extra: 1 })],
    ['campo desconocido en contact', payload({ contact: { full_name: 'A', email: 'a@b.co', ip: '1.2.3.4' } })],
    ['versión distinta', payload({ version: 2 })],
    ['origen distinto de web', payload({ source: 'telefono' })],
    ['fecha en el futuro', payload({ submitted_at: '2026-11-08T12:10:00Z' })],
    ['fecha no válida', payload({ submitted_at: 'ayer' })],
    ['answers no es lista', payload({ answers: { edat: '35' } })],
    ['más de 30 respuestas', payload({ answers: Array.from({ length: 31 }, (_, i) => ({ key: `k${i}`, label: 'L', value: 'v' })) })],
    ['respuesta demasiado larga', payload({ answers: [{ key: 'k', label: 'L', value: 'x'.repeat(2001) }] })],
    ['política sin https', payload({ consent: { accepted: true, text: 'x', policy_url: 'http://centro.example/p' } })],
    ['page_url con javascript:', payload({ page_url: 'javascript:alert(1)' })],
    ['no es un objeto', [1, 2]],
  ]
  it.each(rechazos)('rechaza: %s', (_n, p) => expect(parse(p).ok).toBe(false))
})

// ---------------------------------------------------------------------------
// Ruta POST /api/leads con la BD simulada
const db = vi.hoisted(() => ({
  existing: null as null | { id: string },
  recentCount: 0,
  insertError: null as null | { code: string },
  inserted: [] as unknown[],
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const q: Record<string, unknown> = {}
      let head = false
      q.select = (_c: string, o?: { head?: boolean }) => { head = !!o?.head; return q }
      q.eq = () => q
      q.gte = () => (head ? Promise.resolve({ count: db.recentCount, error: null }) : q)
      q.maybeSingle = () =>
        Promise.resolve(table === 'center_settings'
          ? { data: { default_country_code: '34' }, error: null }
          : { data: db.existing, error: null })
      q.insert = (row: unknown) => { db.inserted.push(row); return Promise.resolve({ error: db.insertError }) }
      return q
    },
  }),
}))

describe('POST /api/leads', () => {
  let POST: (r: Request) => Promise<Response>

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.LEADS_WEBHOOK_SECRET = SECRET
    delete process.env.LEADS_WEBHOOK_SECRET_PREVIOUS
    Object.assign(db, { existing: null, recentCount: 0, insertError: null, inserted: [] })
    POST = (await import('@/app/api/leads/route')).POST
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  function req(body: string, o: { secret?: string; ts?: number; headers?: Record<string, string> } = {}) {
    const ts = String(o.ts ?? NOW_S)
    return new Request('https://app.example/api/leads', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-brotafit-timestamp': ts,
        'x-brotafit-signature': signLeadPayload(o.secret ?? SECRET, ts, body),
        ...o.headers,
      },
      body,
    })
  }

  it('201 y guarda el lead', async () => {
    const res = await POST(req(JSON.stringify(payload())))
    expect(res.status).toBe(201)
    expect(db.inserted).toHaveLength(1)
    expect(db.inserted[0]).toMatchObject({ external_id: 'sub-1', email: 'anna@example.com' })
  })

  it('200 sin duplicar si el envío ya existe', async () => {
    db.existing = { id: 'x' }
    const res = await POST(req(JSON.stringify(payload())))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, duplicate: true })
    expect(db.inserted).toHaveLength(0)
  })

  it('200 si dos envíos iguales chocan con la clave única', async () => {
    db.insertError = { code: '23505' }
    expect((await POST(req(JSON.stringify(payload())))).status).toBe(200)
  })

  it('401 con otro secreto o firma caducada', async () => {
    expect((await POST(req(JSON.stringify(payload()), { secret: OLD_SECRET }))).status).toBe(401)
    expect((await POST(req(JSON.stringify(payload()), { ts: NOW_S - 600 }))).status).toBe(401)
    expect(db.inserted).toHaveLength(0)
  })

  it('400 sin consentimiento, sin guardar', async () => {
    const res = await POST(req(JSON.stringify(payload({ consent: { accepted: false, text: 'x' } }))))
    expect(res.status).toBe(400)
    expect(db.inserted).toHaveLength(0)
  })

  it('400 con JSON no válido pero bien firmado', async () => {
    expect((await POST(req('{no json'))).status).toBe(400)
  })

  it('413 con más de 32 KB', async () => {
    const big = JSON.stringify(payload({ message: 'x'.repeat(33 * 1024) }))
    expect((await POST(req(big))).status).toBe(413)
  })

  it('429 al superar 60 leads nuevos en una hora', async () => {
    db.recentCount = 60
    expect((await POST(req(JSON.stringify(payload())))).status).toBe(429)
    expect(db.inserted).toHaveLength(0)
  })

  it('503 sin secreto configurado (o demasiado corto)', async () => {
    process.env.LEADS_WEBHOOK_SECRET = 'corto'
    expect((await POST(req(JSON.stringify(payload())))).status).toBe(503)
    delete process.env.LEADS_WEBHOOK_SECRET
    expect((await POST(req(JSON.stringify(payload())))).status).toBe(503)
  })

  it('nunca devuelve datos del lead en la respuesta', async () => {
    const res = await POST(req(JSON.stringify(payload())))
    expect(JSON.stringify(await res.json())).not.toMatch(/anna|639/i)
  })
})
