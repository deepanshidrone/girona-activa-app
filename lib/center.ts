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

// Diferencia en minutos entre la hora local de `timezone` y UTC en el instante `d`.
function tzOffsetMinutes(d: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find(p => p.type === t)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - d.getTime()) / 60000)
}

// Instante (ISO, UTC) en que empieza el día 'YYYY-MM-DD' en la zona del centro.
// Sirve para filtrar columnas timestamptz por días del centro.
export function zonedDayStart(date: string, timezone: string = DEFAULT_TIMEZONE): string {
  const midnightUtc = new Date(date + 'T00:00:00Z').getTime()
  let t = midnightUtc - tzOffsetMinutes(new Date(midnightUtc), timezone) * 60000
  t = midnightUtc - tzOffsetMinutes(new Date(t), timezone) * 60000
  return new Date(t).toISOString()
}

// Fecha y hora de un instante en la zona del centro: "08/11/2026, 10:15".
export function formatDateTimeEs(iso: string | null | undefined, timezone: string = DEFAULT_TIMEZONE): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-ES', {
    timeZone: timezone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}
