// Periodos del panel de indicadores (docs/spec-kpis.md §6).
// Todos los periodos son meses enteros, así que cualquier KPI de un periodo se
// obtiene sumando las filas mensuales de kpi_monthly().

import { addMonths, monthStart } from '@/lib/center'

export type PeriodKey = 'mes' | 'mes-anterior' | 'trimestre' | 'anio' | '12m'
export type CompareKey = 'anterior' | 'anio-anterior'

export type Period = {
  key: PeriodKey | 'mes-concreto'
  from: string     // primer día del primer mes
  to: string       // primer día del último mes
  months: string[] // primer día de cada mes, en orden
  label: string
}

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'mes', label: 'Este mes' },
  { key: 'mes-anterior', label: 'Mes anterior' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'anio', label: 'Año' },
  { key: '12m', label: 'Últimos 12 meses' },
]

const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let m = monthStart(from); m <= to; m = addMonths(m, 1)) out.push(m)
  return out
}

export function monthLabel(month: string, short = false): string {
  const idx = Number(month.slice(5, 7)) - 1
  return short ? MONTHS_SHORT[idx] : MONTHS_ES[idx]
}

export function monthYearLabel(month: string, short = false): string {
  return `${monthLabel(month, short)} ${month.slice(0, 4)}`
}

function rangeLabel(from: string, to: string): string {
  if (from === to) return monthYearLabel(from)
  if (from.slice(0, 4) === to.slice(0, 4)) return `${monthLabel(from)} – ${monthYearLabel(to)}`
  return `${monthYearLabel(from)} – ${monthYearLabel(to)}`
}

function build(key: Period['key'], from: string, to: string): Period {
  return { key, from, to, months: monthsBetween(from, to), label: rangeLabel(from, to) }
}

// `value` admite las claves de PERIOD_OPTIONS o un mes concreto 'YYYY-MM'.
export function resolvePeriod(value: string | undefined, today: string): Period {
  const current = monthStart(today)
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const m = value + '-01'
    if (m <= current && m >= '2000-01-01') return build('mes-concreto', m, m)
  }
  switch (value) {
    case 'mes-anterior': {
      const m = addMonths(current, -1)
      return build('mes-anterior', m, m)
    }
    case 'trimestre': {
      const q = Math.floor((Number(current.slice(5, 7)) - 1) / 3) * 3 + 1
      return build('trimestre', `${current.slice(0, 4)}-${String(q).padStart(2, '0')}-01`, current)
    }
    case 'anio':
      return build('anio', `${current.slice(0, 4)}-01-01`, current)
    case '12m':
      return build('12m', addMonths(current, -11), current)
    default:
      return build('mes', current, current)
  }
}

// Periodo de comparación de la misma duración.
export function comparisonPeriod(period: Period, compare: CompareKey): Period {
  const shift = compare === 'anio-anterior' ? -12 : -period.months.length
  return build('mes-concreto', addMonths(period.from, shift), addMonths(period.to, shift))
}

// 12 meses que terminan en el último mes del periodo (gráficos de evolución).
export function seriesMonths(period: Period): string[] {
  return monthsBetween(addMonths(period.to, -11), period.to)
}

// Último día del periodo que ya ha pasado (o hoy si el periodo incluye hoy).
export function periodRefDate(period: Period, today: string): string {
  const end = addMonths(period.to, 1)
  const lastDay = new Date(end + 'T00:00:00Z')
  lastDay.setUTCDate(lastDay.getUTCDate() - 1)
  const iso = lastDay.toISOString().slice(0, 10)
  return iso < today ? iso : today
}
