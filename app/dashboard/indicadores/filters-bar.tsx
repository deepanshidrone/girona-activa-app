'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PERIOD_OPTIONS } from '@/lib/kpis/period'

type Props = {
  employees: { id: string; name: string }[]
  hasUnassigned: boolean
  periodLabel: string
  comparisonLabel: string
}

const selectCls = 'rounded-lg bg-[#1C1C1C] border border-white/10 text-sm text-white px-3 py-2 focus:outline-none focus:border-[#FF914D]/60'

// Filtros del panel (periodo, comparativa, entrenador y tipo de plan), en la URL.
export function FiltersBar({ employees, hasUnassigned, periodLabel, comparisonLabel }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function set(key: string, value: string, defaultValue: string) {
    const next = new URLSearchParams(params.toString())
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const periodo = params.get('periodo') ?? 'mes'
  const isCustomMonth = /^\d{4}-\d{2}$/.test(periodo)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="kpi-periodo">Periodo</label>
        <select id="kpi-periodo" className={selectCls} value={isCustomMonth ? periodo : periodo}
          onChange={e => set('periodo', e.target.value, 'mes')}>
          {isCustomMonth && <option value={periodo}>{periodLabel}</option>}
          {PERIOD_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>

        <label className="sr-only" htmlFor="kpi-comparar">Comparar con</label>
        <select id="kpi-comparar" className={selectCls} value={params.get('comparar') ?? 'anterior'}
          onChange={e => set('comparar', e.target.value, 'anterior')}>
          <option value="anterior">vs periodo anterior</option>
          <option value="anio-anterior">vs mismo periodo del año anterior</option>
        </select>

        <label className="sr-only" htmlFor="kpi-entrenador">Entrenador</label>
        <select id="kpi-entrenador" className={selectCls} value={params.get('entrenador') ?? 'all'}
          onChange={e => set('entrenador', e.target.value, 'all')}>
          <option value="all">Todos los entrenadores</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          {hasUnassigned && <option value="none">Sin asignar</option>}
        </select>

        <label className="sr-only" htmlFor="kpi-tipo">Tipo de plan</label>
        <select id="kpi-tipo" className={selectCls} value={params.get('tipo') ?? 'all'}
          onChange={e => set('tipo', e.target.value, 'all')}>
          <option value="all">Individual y grupal</option>
          <option value="individual">Individual</option>
          <option value="group">Grupal</option>
        </select>
      </div>
      <p className="text-xs text-white/40">
        {periodLabel} · comparado con {comparisonLabel}
      </p>
    </div>
  )
}
