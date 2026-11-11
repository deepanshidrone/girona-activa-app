'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { LEAD_PERIODS, LEAD_VIEWS, leadFiltersQuery, type LeadFilters } from '@/lib/leads/filters'
import type { LeadFilterOptions } from '@/lib/leads/data'
import { LEAD_STATUSES, type LeadStatus } from '@/lib/leads/status'

const BASE = '/dashboard/crm/leads'
const selectCls =
  'rounded-lg bg-[#1C1C1C] border border-white/10 text-sm text-white px-3 py-2 focus:outline-none focus:border-[var(--brand)]/60 max-w-full'

// Filtros del listado de leads (docs/spec-crm.md §8.2). Todo va en la URL;
// cualquier cambio vuelve a la página 1.
export function LeadsFiltersBar({ filters, options }: { filters: LeadFilters; options: LeadFilterOptions }) {
  const router = useRouter()
  const [q, setQ] = useState(filters.q ?? '')

  const go = (over: Partial<LeadFilters>) => router.push(BASE + leadFiltersQuery(filters, { ...over, pagina: 1 }))
  const question = options.questions.find(x => x.key === filters.pregunta)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="lead-periodo">Periodo</label>
        <select id="lead-periodo" className={selectCls} value={filters.periodo}
          onChange={e => go({ periodo: e.target.value as LeadFilters['periodo'] })}>
          {LEAD_PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>

        <label className="sr-only" htmlFor="lead-etapa">Estado</label>
        <select id="lead-etapa" className={selectCls} value={filters.etapa ?? ''}
          onChange={e => go({ etapa: (e.target.value || null) as LeadStatus | null })}>
          <option value="">Todos los estados</option>
          {LEAD_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>

        <label className="sr-only" htmlFor="lead-estado">Visto</label>
        <select id="lead-estado" className={selectCls} value={filters.estado}
          onChange={e => go({ estado: e.target.value as LeadFilters['estado'] })}>
          {LEAD_VIEWS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
        </select>

        {options.channels.length > 0 && (
          <>
            <label className="sr-only" htmlFor="lead-canal">Canal</label>
            <select id="lead-canal" className={selectCls} value={filters.canal ?? ''}
              onChange={e => go({ canal: e.target.value || null })}>
              <option value="">Todos los canales</option>
              {options.channels.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </>
        )}

        {options.questions.length > 0 && (
          <>
            <label className="sr-only" htmlFor="lead-pregunta">Pregunta del formulario</label>
            <select id="lead-pregunta" className={selectCls} value={filters.pregunta ?? ''}
              onChange={e => go({ pregunta: e.target.value || null, valor: null })}>
              <option value="">Filtrar por respuesta…</option>
              {options.questions.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
            </select>
            {question && (
              <>
                <label className="sr-only" htmlFor="lead-valor">Respuesta</label>
                <select id="lead-valor" className={selectCls} value={filters.valor ?? ''}
                  onChange={e => go({ valor: e.target.value || null })}>
                  <option value="">Cualquier respuesta</option>
                  {question.values.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form className="relative flex-1 min-w-[220px] max-w-md"
          onSubmit={e => { e.preventDefault(); go({ q: q.trim() || null }) }}>
          <Search className="h-4 w-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
          <label className="sr-only" htmlFor="lead-q">Buscar</label>
          <input id="lead-q" type="search" value={q} onChange={e => setQ(e.target.value)} maxLength={100}
            placeholder="Buscar por nombre, email o teléfono"
            className="w-full rounded-lg bg-[#1C1C1C] border border-white/10 text-sm text-white pl-9 pr-3 py-2 placeholder:text-white/30 focus:outline-none focus:border-[var(--brand)]/60" />
        </form>

        <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer select-none">
          <input type="checkbox" checked={filters.spam} onChange={e => go({ spam: e.target.checked })}
            className="accent-[var(--brand)]" />
          Ver spam
        </label>

        {(filters.etapa || filters.canal || filters.pregunta || filters.q || filters.estado !== 'todos' || filters.spam || filters.periodo !== '30d') && (
          <button type="button" onClick={() => { setQ(''); router.push(BASE) }}
            className="flex items-center gap-1 text-sm text-white/50 hover:text-white transition-colors">
            <X className="h-3.5 w-3.5" /> Quitar filtros
          </button>
        )}
      </div>
    </div>
  )
}
