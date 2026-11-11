// Filtros del listado de leads (docs/spec-crm.md §8.2). Funciones puras: van en
// la URL para poder guardar o compartir una vista.

import { addMonths, monthStart, addDays, zonedDayStart } from '@/lib/center'
import { isLeadStatus, type LeadStatus } from '@/lib/leads/status'

export const LEAD_PERIODS = [
  { key: '30d', label: 'Últimos 30 días' },
  { key: 'mes', label: 'Este mes' },
  { key: 'mes_anterior', label: 'Mes anterior' },
  { key: 'anio', label: 'Este año' },
  { key: 'todos', label: 'Todo el histórico' },
] as const
export type LeadPeriod = (typeof LEAD_PERIODS)[number]['key']

export const LEAD_VIEWS = [
  { key: 'todos', label: 'Vistos y sin ver' },
  { key: 'sin_ver', label: 'Sin ver' },
  { key: 'vistos', label: 'Vistos' },
] as const
export type LeadView = (typeof LEAD_VIEWS)[number]['key']

export const LEADS_PER_PAGE = 50

export type LeadFilters = {
  periodo: LeadPeriod
  estado: LeadView
  // Estado comercial (§17); `estado` es visto / sin ver
  etapa: LeadStatus | null
  canal: string | null
  pregunta: string | null
  valor: string | null
  q: string | null
  spam: boolean
  pagina: number
}

type SP = { [key: string]: string | string[] | undefined }

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function short(v: string | undefined, max: number): string | null {
  const s = v?.trim()
  return s ? s.slice(0, max) : null
}

export function parseLeadFilters(sp: SP): LeadFilters {
  const periodo = LEAD_PERIODS.some(p => p.key === one(sp.periodo)) ? (one(sp.periodo) as LeadPeriod) : '30d'
  const estado = LEAD_VIEWS.some(v => v.key === one(sp.estado)) ? (one(sp.estado) as LeadView) : 'todos'
  const pregunta = short(one(sp.pregunta), 50)
  const pagina = Math.max(1, Math.min(10_000, Number.parseInt(one(sp.pagina) ?? '1', 10) || 1))
  return {
    periodo,
    estado,
    etapa: isLeadStatus(one(sp.etapa)) ? (one(sp.etapa) as LeadStatus) : null,
    canal: short(one(sp.canal), 50),
    pregunta,
    valor: pregunta ? short(one(sp.valor), 2000) : null,
    q: short(one(sp.q), 100),
    spam: one(sp.spam) === '1',
    pagina,
  }
}

// Límites del periodo como instantes UTC (received_at es timestamptz), con los
// días contados en la zona del centro. `to` es exclusivo.
export function leadPeriodRange(periodo: LeadPeriod, today: string, timezone: string): { from: string | null; to: string | null } {
  const tomorrow = zonedDayStart(addDays(today, 1), timezone)
  switch (periodo) {
    case '30d': return { from: zonedDayStart(addDays(today, -29), timezone), to: tomorrow }
    case 'mes': return { from: zonedDayStart(monthStart(today), timezone), to: tomorrow }
    case 'mes_anterior': return {
      from: zonedDayStart(addMonths(monthStart(today), -1), timezone),
      to: zonedDayStart(monthStart(today), timezone),
    }
    case 'anio': return { from: zonedDayStart(today.slice(0, 4) + '-01-01', timezone), to: tomorrow }
    case 'todos': return { from: null, to: null }
  }
}

// Texto de búsqueda seguro para un filtro .or() de PostgREST: fuera los
// caracteres con significado en su sintaxis (, . ( ) * % \ : ").
export function sanitizeSearch(q: string): string {
  return q.replace(/[,.()*%\\:"]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Query string de los filtros, sin los valores por defecto. `over` cambia
// algunos (por ejemplo la página); al cambiar un filtro se vuelve a la página 1.
export function leadFiltersQuery(f: LeadFilters, over: Partial<LeadFilters> = {}): string {
  const v = { ...f, ...over }
  const q = new URLSearchParams()
  if (v.periodo !== '30d') q.set('periodo', v.periodo)
  if (v.estado !== 'todos') q.set('estado', v.estado)
  if (v.etapa) q.set('etapa', v.etapa)
  if (v.canal) q.set('canal', v.canal)
  if (v.pregunta) q.set('pregunta', v.pregunta)
  if (v.pregunta && v.valor) q.set('valor', v.valor)
  if (v.q) q.set('q', v.q)
  if (v.spam) q.set('spam', '1')
  if (v.pagina > 1) q.set('pagina', String(v.pagina))
  const s = q.toString()
  return s ? `?${s}` : ''
}
