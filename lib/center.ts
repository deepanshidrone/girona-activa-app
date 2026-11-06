// Fechas en la zona horaria del centro. Las fechas de negocio se manejan como
// texto 'YYYY-MM-DD' para no depender de la zona horaria del servidor (UTC en
// Vercel): toISOString() da el día equivocado entre las 00:00 y las 02:00.

export const DEFAULT_TIMEZONE = 'Europe/Madrid'

export function todayIn(timezone: string = DEFAULT_TIMEZONE, now: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function addMonths(date: string, months: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

// Primer día del mes de una fecha 'YYYY-MM-DD'.
export function monthStart(date: string): string {
  return date.slice(0, 7) + '-01'
}

// Último día del mes de una fecha 'YYYY-MM-DD'.
export function monthEnd(date: string): string {
  return addDays(addMonths(monthStart(date), 1), -1)
}

// Años cumplidos en la fecha `on` ('YYYY-MM-DD').
export function ageOn(birthDate: string | null | undefined, on: string): number | null {
  if (!birthDate) return null
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number)
  const [y, m, d] = on.split('-').map(Number)
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0)
}

export function formatDateEs(date: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }): string {
  if (!date) return '—'
  return new Date(date + 'T12:00:00Z').toLocaleDateString('es-ES', { ...opts, timeZone: 'UTC' })
}
