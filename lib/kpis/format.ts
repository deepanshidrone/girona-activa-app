// Formato de números del panel de indicadores (es-ES).

const nf0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

export function fmtNum(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return (decimals ? nf1 : nf0).format(v)
}

export function fmtPct(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  return `${(decimals ? nf1 : nf0).format(v)} %`
}

export function fmtHours(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—'
  return `${nf1.format(minutes / 60)} h`
}

// Variación frente al periodo de comparación: puntos (pp) para porcentajes,
// diferencia absoluta para recuentos.
export function fmtDelta(cur: number | null, prev: number | null, kind: 'pct' | 'count'): { text: string; dir: 'up' | 'down' | 'flat' } | null {
  if (cur === null || prev === null) return null
  const d = cur - prev
  const dir = Math.abs(d) < (kind === 'pct' ? 0.05 : 0.5) ? 'flat' : d > 0 ? 'up' : 'down'
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±'
  const abs = Math.abs(d)
  return { text: kind === 'pct' ? `${sign}${nf1.format(abs)} pp` : `${sign}${nf0.format(abs)}`, dir }
}
