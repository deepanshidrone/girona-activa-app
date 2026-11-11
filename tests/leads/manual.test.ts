import { describe, expect, it } from 'vitest'
import { buildLeadFormCatalog, MANUAL_CONSENT_TEXT, parseManualLead, type LeadFormCatalog } from '@/lib/leads/manual'
import { isLeadStatus, leadStatusInfo } from '@/lib/leads/status'
import { leadFiltersQuery, parseLeadFilters } from '@/lib/leads/filters'

// Alta manual (docs/spec-crm.md §16) y estado del lead (§17)

const NOW = new Date('2026-11-11T10:00:00Z')
const catalog: LeadFormCatalog = {
  questions: [
    { key: 'edat', label: 'Edat', suggestions: [], long: false },
    { key: 'inversio', label: 'Inversió mensual', suggestions: ['Menys de 50€'], long: false },
  ],
  channels: [{ key: 'instagram', label: 'Instagram' }],
  policyUrl: 'https://centro.example/privacidad',
}
const ok = { full_name: '  Anna   Puig ', phone: '639 11 22 33', consent: true }
const parse = (f: Parameters<typeof parseManualLead>[0]) => parseManualLead(f, catalog, { now: NOW, countryCode: '34' })

describe('parseManualLead', () => {
  it('alta mínima válida', () => {
    const r = parse(ok)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lead).toMatchObject({
      source: 'manual',
      full_name: 'Anna Puig',
      phone_normalized: '34639112233',
      email: null,
      status: 'nuevo',
      received_at: NOW.toISOString(),
      consent_at: NOW.toISOString(),
      consent_text: MANUAL_CONSENT_TEXT,
      privacy_policy_url: 'https://centro.example/privacidad',
      answers: [],
    })
    expect(r.notes).toBeNull()
  })

  it('sin consentimiento no se guarda', () => {
    const r = parse({ ...ok, consent: false })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.consent).toBeTruthy()
  })

  it('pide nombre y teléfono o email', () => {
    const r = parse({ consent: true })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.full_name).toBeTruthy()
      expect(r.errors.phone).toMatch(/teléfono o un email/)
    }
  })

  it('valida email y teléfono', () => {
    const r = parse({ ...ok, phone: '639.11.22', email: 'no-es-email' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors.phone).toBeTruthy()
      expect(r.errors.email).toBeTruthy()
    }
  })

  it('email en minúsculas y solo email vale', () => {
    const r = parse({ full_name: 'Marc', email: ' Marc@Example.COM ', consent: true })
    expect(r.ok && r.lead.email).toBe('marc@example.com')
  })

  it('canal: solo uno del catálogo, con su etiqueta', () => {
    const r = parse({ ...ok, channel_key: 'instagram' })
    expect(r.ok && [r.lead.channel_key, r.lead.channel_label]).toEqual(['instagram', 'Instagram'])
    const bad = parse({ ...ok, channel_key: 'inventado' })
    expect(bad.ok).toBe(false)
  })

  it('respuestas: solo las del catálogo, en su orden y con su etiqueta; las vacías no se guardan', () => {
    const r = parse({ ...ok, answers: { inversio: 'Menys de 50€', edat: ' 35 ', otra: 'x', } })
    expect(r.ok && r.lead.answers).toEqual([
      { key: 'edat', label: 'Edat', value: '35' },
      { key: 'inversio', label: 'Inversió mensual', value: 'Menys de 50€' },
    ])
    const empty = parse({ ...ok, answers: { edat: '   ' } })
    expect(empty.ok && empty.lead.answers).toEqual([])
  })

  it('estado elegido y estado no válido', () => {
    const r = parse({ ...ok, status: 'contactado' })
    expect(r.ok && r.lead.status).toBe('contactado')
    expect(parse({ ...ok, status: 'otro' }).ok).toBe(false)
  })

  it('el comentario va aparte (nota interna)', () => {
    const r = parse({ ...ok, notes: '  Prefiere tardes\n' })
    expect(r.ok && r.notes).toBe('Prefiere tardes')
  })
})

describe('buildLeadFormCatalog', () => {
  const a = (key: string, label: string, value: string) => ({ key, label, value })
  const rows = [
    { channel_key: 'google', channel_label: 'Google', privacy_policy_url: 'https://nueva', answers: [a('edat', 'Edat', '35'), a('inv', 'Inversió', '50 – 100€')] },
    { channel_key: 'instagram', channel_label: 'Instagram', privacy_policy_url: 'https://vieja', answers: [a('obj', 'Objectiu', 'x'.repeat(80)), a('edat', 'Edat antigua', '40'), a('inv', 'Inversió', 'Més de 150€')] },
    { channel_key: 'google', channel_label: 'Google', privacy_policy_url: null, answers: null },
  ]
  const c = buildLeadFormCatalog(rows)

  it('preguntas en el orden del lead más reciente; las antiguas, detrás', () =>
    expect(c.questions.map(q => q.key)).toEqual(['edat', 'inv', 'obj']))
  it('etiqueta del lead más reciente', () => expect(c.questions[0].label).toBe('Edat'))
  it('sugerencias de las preguntas cortas; las largas van en área de texto', () => {
    expect(c.questions[1].suggestions).toEqual(['50 – 100€', 'Més de 150€'])
    expect(c.questions[2]).toMatchObject({ long: true, suggestions: [] })
  })
  it('canales sin repetir y política del más reciente', () => {
    expect(c.channels).toEqual([{ key: 'google', label: 'Google' }, { key: 'instagram', label: 'Instagram' }])
    expect(c.policyUrl).toBe('https://nueva')
  })
  it('sin leads web, catálogo vacío', () =>
    expect(buildLeadFormCatalog([])).toEqual({ questions: [], channels: [], policyUrl: null }))
})

describe('estado del lead', () => {
  it('claves válidas', () => {
    expect(isLeadStatus('entrenamiento_iniciado')).toBe(true)
    expect(isLeadStatus('convertido')).toBe(false)
  })
  it('un estado desconocido se muestra como Nuevo', () => expect(leadStatusInfo('x').label).toBe('Nuevo'))
  it('filtro etapa en la URL', () => {
    const f = parseLeadFilters({ etapa: 'sin_contestacion' })
    expect(f.etapa).toBe('sin_contestacion')
    expect(leadFiltersQuery(f)).toBe('?etapa=sin_contestacion')
    expect(parseLeadFilters({ etapa: 'inventado' }).etapa).toBeNull()
  })
})
