// Estado comercial del lead (docs/spec-crm.md §17). Las claves están en la BD
// (check leads_status_check); aquí las etiquetas, genéricas para cualquier centro.

export const LEAD_STATUSES = [
  { key: 'nuevo', label: 'Nuevo', cls: 'bg-[var(--brand)]/15 text-[var(--brand)]' },
  { key: 'contactado', label: 'Contactado', cls: 'bg-sky-500/15 text-sky-300' },
  { key: 'sin_contestacion', label: 'Sin contestación', cls: 'bg-amber-500/15 text-amber-300' },
  { key: 'entrenamiento_iniciado', label: 'Entrenamiento iniciado', cls: 'bg-green-500/15 text-green-300' },
  { key: 'no_convertido', label: 'No convertido', cls: 'bg-white/10 text-white/55' },
] as const

export type LeadStatus = (typeof LEAD_STATUSES)[number]['key']

export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === 'string' && LEAD_STATUSES.some(s => s.key === v)
}

export function leadStatusInfo(status: string) {
  return LEAD_STATUSES.find(s => s.key === status) ?? LEAD_STATUSES[0]
}
