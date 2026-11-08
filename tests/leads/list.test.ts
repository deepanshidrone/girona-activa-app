import { describe, expect, it } from 'vitest'
import { formatDateTimeEs, zonedDayStart } from '@/lib/center'
import { leadFiltersQuery, leadPeriodRange, parseLeadFilters, sanitizeSearch } from '@/lib/leads/filters'
import { findDuplicates } from '@/lib/leads/duplicates'
import { mailHref, telHref, whatsappHref } from '@/lib/leads/contact'

describe('zonedDayStart', () => {
  it('medianoche de Madrid en invierno (UTC+1)', () =>
    expect(zonedDayStart('2026-11-08', 'Europe/Madrid')).toBe('2026-11-07T23:00:00.000Z'))
  it('medianoche de Madrid en verano (UTC+2)', () =>
    expect(zonedDayStart('2026-07-01', 'Europe/Madrid')).toBe('2026-06-30T22:00:00.000Z'))
  it('día del cambio de hora', () =>
    expect(zonedDayStart('2026-03-29', 'Europe/Madrid')).toBe('2026-03-28T23:00:00.000Z'))
  it('formatea en la zona del centro', () =>
    expect(formatDateTimeEs('2026-11-07T23:30:00Z', 'Europe/Madrid')).toBe('08/11/2026, 00:30'))
})

describe('parseLeadFilters', () => {
  it('valores por defecto', () => {
    expect(parseLeadFilters({})).toEqual({
      periodo: '30d', estado: 'todos', canal: null, pregunta: null, valor: null, q: null, spam: false, pagina: 1,
    })
  })
  it('ignora valores no válidos', () => {
    const f = parseLeadFilters({ periodo: 'siempre', estado: 'raro', pagina: '-3', spam: 'si' })
    expect(f).toMatchObject({ periodo: '30d', estado: 'todos', pagina: 1, spam: false })
  })
  it('el valor solo cuenta con pregunta', () => {
    expect(parseLeadFilters({ valor: 'x' }).valor).toBeNull()
    expect(parseLeadFilters({ pregunta: 'inversio', valor: 'x' }).valor).toBe('x')
  })
  it('ida y vuelta por la URL', () => {
    const f = parseLeadFilters({ periodo: 'mes', estado: 'sin_ver', canal: 'google', pregunta: 'inversio', valor: '50 – 100€', q: 'anna', spam: '1', pagina: '2' })
    const back = parseLeadFilters(Object.fromEntries(new URLSearchParams(leadFiltersQuery(f).slice(1))))
    expect(back).toEqual(f)
  })
  it('sin filtros, sin query', () => expect(leadFiltersQuery(parseLeadFilters({}))).toBe(''))
})

describe('leadPeriodRange (Madrid, hoy 2026-11-08)', () => {
  const r = (p: Parameters<typeof leadPeriodRange>[0]) => leadPeriodRange(p, '2026-11-08', 'Europe/Madrid')
  it('últimos 30 días, hoy incluido', () =>
    expect(r('30d')).toEqual({ from: '2026-10-09T22:00:00.000Z', to: '2026-11-08T23:00:00.000Z' }))
  it('este mes', () => expect(r('mes').from).toBe('2026-10-31T23:00:00.000Z'))
  it('mes anterior', () =>
    expect(r('mes_anterior')).toEqual({ from: '2026-09-30T22:00:00.000Z', to: '2026-10-31T23:00:00.000Z' }))
  it('este año', () => expect(r('anio').from).toBe('2025-12-31T23:00:00.000Z'))
  it('todos', () => expect(r('todos')).toEqual({ from: null, to: null }))
})

describe('sanitizeSearch', () => {
  it('quita la sintaxis de PostgREST', () => expect(sanitizeSearch('a,b.or(c)*%:"d"')).toBe('a b or c d'))
})

describe('findDuplicates', () => {
  const lead = { id: '1', email: 'anna@example.com', phone_normalized: '34600000000' }
  it('por email, por teléfono y sin contar el propio lead', () => {
    const related = [
      lead,
      { id: '2', email: 'ANNA@example.com', phone_normalized: null },
      { id: '3', email: null, phone_normalized: '34600000000' },
      { id: '4', email: 'otra@example.com', phone_normalized: '34611111111' },
    ]
    expect(findDuplicates(lead, related, []).otherLeadIds).toEqual(['2', '3'])
  })
  it('ya es cliente por email, sin distinguir mayúsculas', () => {
    const clients = [{ id: 'c1', email: ' Anna@Example.com', first_name: 'Anna', last_name: 'Puig' }]
    expect(findDuplicates(lead, [], clients).client).toEqual({ id: 'c1', name: 'Anna Puig' })
  })
  it('sin email no busca cliente', () => {
    const clients = [{ id: 'c1', email: null, first_name: 'X', last_name: null }]
    expect(findDuplicates({ ...lead, email: null }, [], clients).client).toBeNull()
  })
})

describe('enlaces de contacto', () => {
  it('teléfono y WhatsApp en formato internacional', () => {
    expect(telHref('34639582757')).toBe('tel:+34639582757')
    expect(whatsappHref('34639582757')).toBe('https://wa.me/34639582757')
  })
  it('nada si el dato no es válido', () => {
    expect(telHref(null)).toBeNull()
    expect(whatsappHref('12ab')).toBeNull()
    expect(mailHref('javascript:alert(1)')).toBeNull()
  })
  it('email', () => expect(mailHref('anna@example.com')).toBe('mailto:anna@example.com'))
})
