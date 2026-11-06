// Estados del cliente (docs/spec-kpis.md §5.4):
//   active    de alta y con un plan vigente
//   inactive  de alta sin plan vigente
//   baja      se ha ido del centro (baja manual con fecha y motivo)

export type ClientState = 'active' | 'inactive' | 'baja'

export const CLIENT_STATE_LABEL: Record<ClientState, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
  baja: 'Baja',
}

export const CLIENT_STATE_BADGE: Record<ClientState, string> = {
  active: 'bg-green-500/15 text-green-400',
  inactive: 'bg-amber-500/15 text-amber-300',
  baja: 'bg-white/5 text-white/40',
}

type PeriodLike = { started_on: string; ended_on: string | null }
type PlanLike = { start_date: string; end_date: string; ended_on?: string | null; status: string }

// Fin efectivo de un plan: ended_on si se cerró antes de tiempo.
export function planEffectiveEnd(plan: PlanLike): string {
  return plan.ended_on ?? plan.end_date
}

export function isPlanCurrent(plan: PlanLike, date: string): boolean {
  return plan.status !== 'draft' && plan.start_date <= date && planEffectiveEnd(plan) >= date
}

export function clientStateOn(periods: PeriodLike[], plans: PlanLike[], date: string): ClientState | null {
  const covering = periods.some(p => p.started_on <= date && (p.ended_on === null || p.ended_on > date))
  if (!covering) return periods.some(p => p.started_on <= date) ? 'baja' : null
  return plans.some(p => isPlanCurrent(p, date)) ? 'active' : 'inactive'
}
