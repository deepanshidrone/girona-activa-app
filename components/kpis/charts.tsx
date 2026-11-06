'use client'

// Gráficos del panel de indicadores. SVG propio (sin librería) en el tema
// oscuro del dashboard. Reglas: marcas finas, una sola escala, leyenda con
// 2+ series, el texto nunca lleva el color de la serie, tooltip al pasar el
// ratón y estado vacío explícito ("sin datos" no es 0).

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { fmtNum, fmtPct } from '@/lib/kpis/format'

// Paleta categórica oscura validada sobre #1C1C1C (orden fijo) y estados.
export const VIZ = {
  surface: '#1C1C1C',
  series: ['#3987e5', '#d95926', '#199e70', '#c98500'],
  good: '#0ca30c',
  warning: '#fab219',
  critical: '#d03b3b',
  grid: '#2c2c2a',
  axis: '#383835',
  muted: '#898781',
  ink2: '#c3c2b7',
  spark: '#5c5b56',
  seq: ['#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7', '#6da7ec', '#86b6ef'],
} as const

export function EmptyChart({ message, height = 160 }: { message: string; height?: number }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 text-center px-4" style={{ height }}>
      <p className="text-xs text-white/40">{message}</p>
    </div>
  )
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
      {items.map(i => (
        <span key={i.label} className="flex items-center gap-1.5 text-xs text-white/60">
          {i.dashed
            ? <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: i.color }} />
            : <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />}
          {i.label}
        </span>
      ))}
    </div>
  )
}

// Ancho real del contenedor: el SVG se dibuja a escala 1 y el texto no se encoge.
function useWidth(initial = 560) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(initial)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0].contentRect.width)
      if (w > 0) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

function Tooltip({ x, children }: { x: number; children: ReactNode }) {
  // x en % del ancho; se ancla a la izquierda o derecha para no salirse
  const right = x > 60
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 rounded-lg bg-black/90 border border-white/10 px-2.5 py-1.5 text-xs text-white whitespace-nowrap shadow-lg"
      style={right ? { right: `${100 - x}%`, marginRight: 8 } : { left: `${x}%`, marginLeft: 8 }}
    >
      {children}
    </div>
  )
}

// ── Sparkline (tarjetas) ────────────────────────────────────────────────────
export function Sparkline({ values }: { values: (number | null)[] }) {
  const pts = values.map((v, i) => ({ v, i })).filter(p => p.v !== null) as { v: number; i: number }[]
  if (pts.length < 2) return <div className="h-8" />
  const W = 120, H = 32, pad = 3
  const min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v))
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (W - pad * 2)
  const y = (v: number) => (max === min ? H / 2 : H - pad - ((v - min) / (max - min)) * (H - pad * 2))
  // Tramos continuos (los meses sin dato cortan la línea)
  const segments: string[] = []
  let seg = ''
  values.forEach((v, i) => {
    if (v === null) { if (seg) segments.push(seg); seg = ''; return }
    seg += `${seg ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  if (seg) segments.push(seg)
  const lastPt = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8" aria-hidden>
      {segments.map((d, k) => <path key={k} d={d} fill="none" stroke={VIZ.spark} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />)}
      <circle cx={x(lastPt.i)} cy={y(lastPt.v)} r={3.5} fill={VIZ.series[0]} stroke={VIZ.surface} strokeWidth={2} />
    </svg>
  )
}

// ── Columnas apiladas por mes ───────────────────────────────────────────────
export function StackedColumns({
  labels, series, height = 180, emptyMessage,
}: {
  labels: string[]
  series: { label: string; values: number[] }[]
  height?: number
  emptyMessage: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [ref, width] = useWidth()
  const totals = labels.map((_, i) => series.reduce((acc, s) => acc + (s.values[i] ?? 0), 0))
  const max = Math.max(0, ...totals)
  if (max === 0) return <EmptyChart message={emptyMessage} height={height} />

  const W = width, H = height, top = 10, bottom = 22, left = 34
  const plotH = H - top - bottom
  const band = (W - left) / labels.length
  const barW = Math.min(24, band * 0.6)
  const niceMax = niceCeil(max)
  const y = (v: number) => top + plotH - (v / niceMax) * plotH
  const ticks = [0, niceMax / 2, niceMax]

  return (
    <div>
      <div className="relative" ref={ref}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth={1} />
              <text x={left - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={VIZ.muted}>{fmtNum(t)}</text>
            </g>
          ))}
          {labels.map((label, i) => {
            const cx = left + band * i + band / 2
            let acc = 0
            const segs = series.map((s, k) => {
              const v = s.values[i] ?? 0
              const y0 = y(acc), y1 = y(acc + v)
              acc += v
              if (v <= 0) return null
              const isTop = series.slice(k + 1).every(n => (n.values[i] ?? 0) <= 0)
              const h = Math.max(0, y0 - y1 - (acc - v > 0 ? 2 : 0)) // 2px de separación entre segmentos
              return <rect key={k} x={cx - barW / 2} y={y1} width={barW} height={h} rx={isTop ? 4 : 0} fill={VIZ.series[k]} />
            })
            return (
              <g key={label}>
                {segs}
                <rect x={left + band * i} y={top} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
                <text x={cx} y={H - 6} textAnchor="middle" fontSize={10} fill={hover === i ? VIZ.ink2 : VIZ.muted}>{label}</text>
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <Tooltip x={((left + band * hover + band / 2) / W) * 100}>
            <p className="font-semibold mb-0.5">{labels[hover]}</p>
            {series.map((s, k) => (
              <p key={s.label} className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-sm" style={{ background: VIZ.series[k] }} />
                {s.label}: {fmtNum(s.values[hover] ?? 0)}
              </p>
            ))}
          </Tooltip>
        )}
      </div>
      <Legend items={series.map((s, k) => ({ label: s.label, color: VIZ.series[k] }))} />
    </div>
  )
}

// ── Línea de un porcentaje por mes, con banda objetivo ─────────────────────
export function PercentLine({
  labels, values, target, height = 180, emptyMessage, title,
}: {
  labels: string[]
  values: (number | null)[]
  target?: { min: number | null; max: number | null }
  height?: number
  emptyMessage: string
  title: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const [ref, width] = useWidth()
  if (values.every(v => v === null)) return <EmptyChart message={emptyMessage} height={height} />

  const W = width, H = height, top = 10, bottom = 22, left = 34
  const plotH = H - top - bottom
  const dataMax = Math.max(0, ...values.filter((v): v is number => v !== null), target?.max ?? 0, target?.min ?? 0)
  const yMax = dataMax > 100 ? niceCeil(dataMax) : 100
  const y = (v: number) => top + plotH - (v / yMax) * plotH
  const step = (W - left) / labels.length
  const x = (i: number) => left + step * i + step / 2
  let d = ''
  values.forEach((v, i) => {
    if (v === null) return
    const prev = i > 0 ? values[i - 1] : null
    d += `${prev === null || i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  const ticks = [0, yMax / 2, yMax]
  const bandTop = target?.max ?? (target?.min !== null && target?.min !== undefined ? yMax : null)
  const bandBottom = target?.min ?? (target?.max !== null && target?.max !== undefined ? 0 : null)

  return (
    <div>
      <div className="relative" ref={ref}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
          {bandTop !== null && bandBottom !== null && (
            <rect x={left} width={W - left} y={y(bandTop)} height={Math.max(0, y(bandBottom) - y(bandTop))} fill={VIZ.good} opacity={0.08} />
          )}
          {ticks.map(t => (
            <g key={t}>
              <line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} strokeWidth={1} />
              <text x={left - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={VIZ.muted}>{fmtNum(t)}%</text>
            </g>
          ))}
          {[target?.min, target?.max].map((t, k) => (t !== null && t !== undefined) ? (
            <line key={k} x1={left} x2={W} y1={y(t)} y2={y(t)} stroke={VIZ.good} strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
          ) : null)}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={top} y2={top + plotH} stroke={VIZ.axis} strokeWidth={1} />}
          <path d={d} fill="none" stroke={VIZ.series[0]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {values.map((v, i) => v === null ? null : (
            <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3.5} fill={VIZ.series[0]} stroke={VIZ.surface} strokeWidth={2} />
          ))}
          {labels.map((label, i) => (
            <g key={label}>
              <rect x={left + step * i} y={top} width={step} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} />
              <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill={hover === i ? VIZ.ink2 : VIZ.muted}>{label}</text>
            </g>
          ))}
        </svg>
        {hover !== null && (
          <Tooltip x={(x(hover) / W) * 100}>
            <p className="font-semibold">{labels[hover]}</p>
            <p>{title}: {values[hover] === null ? 'sin datos' : fmtPct(values[hover], 1)}</p>
          </Tooltip>
        )}
      </div>
      {target && (target.min !== null || target.max !== null) && (
        <Legend items={[{ label: title, color: VIZ.series[0] }, { label: 'Objetivo', color: VIZ.good, dashed: true }]} />
      )}
    </div>
  )
}

// ── Barras horizontales (una serie) ─────────────────────────────────────────
export function HBars({ items, emptyMessage, decimals = 0, suffix = '' }: {
  items: { label: string; value: number; note?: string }[]
  emptyMessage: string
  decimals?: number
  suffix?: string
}) {
  const format = (v: number) => `${fmtNum(v, decimals)}${suffix}`
  const max = Math.max(0, ...items.map(i => i.value))
  if (items.length === 0 || max === 0) return <EmptyChart message={emptyMessage} height={120} />
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map(i => (
        <li key={i.label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-xs" title={`${i.label}: ${format(i.value)}`}>
          <span className="text-white/70 truncate">{i.label}</span>
          <span className="h-3 rounded-r bg-white/[0.03]">
            <span className="block h-3 rounded-r" style={{ width: `${(i.value / max) * 100}%`, background: VIZ.series[0] }} />
          </span>
          <span className="text-white tabular-nums">{format(i.value)}{i.note ? <span className="text-white/40"> {i.note}</span> : null}</span>
        </li>
      ))}
    </ul>
  )
}

// ── Mapa de calor día × hora ───────────────────────────────────────────────
const DOW = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export function Heatmap({ cells, emptyMessage }: {
  cells: { dow: number; time: string; booked: number; seats: number; pct: number | null; attPct: number | null }[]
  emptyMessage: string
}) {
  if (cells.length === 0) return <EmptyChart message={emptyMessage} height={160} />
  const days = [...new Set(cells.map(c => c.dow))].sort()
  const times = [...new Set(cells.map(c => c.time))].sort()
  const get = (d: number, t: string) => cells.find(c => c.dow === d && c.time === t)
  const color = (p: number | null) => {
    if (p === null) return 'transparent'
    if (p === 0) return 'rgba(255,255,255,0.04)' // vacío: se funde con el fondo
    const idx = Math.min(VIZ.seq.length - 1, Math.floor((p / 100) * VIZ.seq.length))
    return VIZ.seq[idx]
  }
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th />
            {days.map(d => <th key={d} className="font-medium text-white/40 px-1 pb-1">{DOW[d]}</th>)}
          </tr>
        </thead>
        <tbody>
          {times.map(t => (
            <tr key={t}>
              <td className="text-white/40 pr-2 tabular-nums">{t}</td>
              {days.map(d => {
                const c = get(d, t)
                if (!c) return <td key={d} className="w-14 h-8 rounded bg-white/[0.02]" />
                const label = `${DOW[d]} ${t}: ${fmtNum(c.booked)} de ${fmtNum(c.seats)} plazas (${fmtPct(c.pct)})${c.attPct !== null ? ` · asistencia ${fmtPct(c.attPct)}` : ''}`
                return (
                  <td key={d} title={label} aria-label={label}
                    className="w-14 h-8 rounded text-center tabular-nums border border-white/5"
                    style={{ background: color(c.pct), color: (c.pct ?? 0) >= 50 ? '#ffffff' : VIZ.ink2 }}>
                    {fmtPct(c.pct)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mt-2 text-xs text-white/40">
        <span>0 %</span>
        <span className="flex">{VIZ.seq.map(c => <span key={c} className="w-4 h-2.5" style={{ background: c }} />)}</span>
        <span>100 %</span>
        <span className="ml-2">plazas ocupadas ÷ plazas ofertadas</span>
      </div>
    </div>
  )
}

// ── RPE / RIR real frente al objetivo de cada semana del ciclo ─────────────
export function WeekTargetChart({ weeks, metric, emptyMessage }: {
  weeks: { week: number; phase: string; actual: number | null; min: number; max: number }[]
  metric: 'RPE' | 'RIR'
  emptyMessage: string
}) {
  const [ref, width] = useWidth()
  if (weeks.every(w => w.actual === null)) {
    return (
      <div>
        <EmptyChart message={emptyMessage} height={120} />
        <TargetList weeks={weeks} metric={metric} />
      </div>
    )
  }
  const W = width, H = 150, top = 10, bottom = 30, left = 30
  const plotH = H - top - bottom
  const y = (v: number) => top + plotH - (v / 10) * plotH
  const step = (W - left) / weeks.length
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
        {[0, 5, 10].map(t => (
          <g key={t}>
            <line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? VIZ.axis : VIZ.grid} />
            <text x={left - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill={VIZ.muted}>{t}</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const cx = left + step * i + step / 2
          const bandH = Math.max(4, y(w.min) - y(w.max))
          return (
            <g key={w.week}>
              <title>{`Semana ${w.week} (${w.phase}): objetivo ${w.min === w.max ? w.min : `${w.min}-${w.max}`}, real ${w.actual === null ? 'sin datos' : fmtNum(w.actual, 1)}`}</title>
              <rect x={cx - 22} width={44} y={y(w.max) - (bandH === 4 ? 2 : 0)} height={bandH} rx={3} fill={VIZ.good} opacity={0.25} />
              {w.actual !== null && <circle cx={cx} cy={y(w.actual)} r={5} fill={VIZ.series[0]} stroke={VIZ.surface} strokeWidth={2} />}
              <text x={cx} y={H - 16} textAnchor="middle" fontSize={10} fill={VIZ.ink2}>Semana {w.week}</text>
              <text x={cx} y={H - 4} textAnchor="middle" fontSize={9} fill={VIZ.muted}>{w.phase}</text>
            </g>
          )
        })}
      </svg>
      <Legend items={[{ label: `${metric} real (media)`, color: VIZ.series[0] }, { label: 'Rango objetivo', color: VIZ.good }]} />
    </div>
  )
}

function TargetList({ weeks, metric }: { weeks: { week: number; phase: string; min: number; max: number }[]; metric: string }) {
  return (
    <p className="text-xs text-white/40 mt-2">
      Objetivo {metric}: {weeks.map(w => `S${w.week} ${w.min === w.max ? w.min : `${w.min}-${w.max}`}`).join(' · ')}
    </p>
  )
}

function niceCeil(v: number): number {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return Math.max(2, nice * exp)
}
