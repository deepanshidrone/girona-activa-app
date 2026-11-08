'use client'

import { useState } from 'react'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Columnas de una sola serie: sesiones completadas por mes.
// Guía dataviz: columnas finas (≤24px) con 4px redondeados solo arriba y base
// recta; sin leyenda (una serie, el título la nombra); el valor solo en la
// columna seleccionada (por defecto, el mes actual) y en el texto de abajo;
// tabla accesible para lectores de pantalla.
export function MonthlyBars({ data }: { data: { month: string; completed: number }[] }) {
  const [selected, setSelected] = useState(data.length - 1)
  const max = Math.max(1, ...data.map(d => d.completed))
  const sel = data[selected]
  const monthIdx = (ym: string) => Number(ym.slice(5, 7)) - 1

  return (
    <figure className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4 m-0">
      <figcaption className="text-sm text-white/70 mb-3">Sesiones hechas por mes</figcaption>

      <div className="relative h-32 flex items-end justify-between gap-2 border-b border-white/15" aria-hidden="true">
        {data.map((d, i) => {
          const h = Math.round((d.completed / max) * 100)
          const isSel = i === selected
          return (
            <button
              key={d.month}
              type="button"
              tabIndex={-1}
              onClick={() => setSelected(i)}
              onMouseEnter={() => setSelected(i)}
              className="flex-1 h-full flex flex-col items-center justify-end"
            >
              {isSel && <span className="text-xs font-semibold text-white mb-1">{d.completed}</span>}
              <span
                className={`w-full max-w-6 rounded-t-[4px] transition-opacity ${isSel ? 'opacity-100' : 'opacity-55'}`}
                style={{ height: d.completed ? `max(${h}%, 4px)` : '0px', background: 'var(--brand)' }}
              />
            </button>
          )
        })}
      </div>
      <div className="flex justify-between gap-2 mt-1.5" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.month} className={`flex-1 text-center text-[11px] ${i === selected ? 'text-white/80' : 'text-white/35'}`}>
            {MONTHS[monthIdx(d.month)]}
          </span>
        ))}
      </div>
      <p className="text-xs text-white/50 mt-3" aria-live="polite">
        {MONTHS_LONG[monthIdx(sel.month)]} {sel.month.slice(0, 4)}: {sel.completed} {sel.completed === 1 ? 'sesión' : 'sesiones'}
      </p>

      <table className="sr-only">
        <caption>Sesiones hechas por mes</caption>
        <thead><tr><th>Mes</th><th>Sesiones</th></tr></thead>
        <tbody>
          {data.map(d => (
            <tr key={d.month}><td>{MONTHS_LONG[monthIdx(d.month)]} {d.month.slice(0, 4)}</td><td>{d.completed}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
