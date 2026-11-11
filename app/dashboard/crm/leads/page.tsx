import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Inbox, Phone, MessageCircle, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffUser, hasPermission } from '@/lib/auth/permissions'
import { getCenterTimezone } from '@/lib/center-settings'
import { formatDateTimeEs, todayIn } from '@/lib/center'
import { countUnseenLeads, getLeadFilterOptions, listLeads, type LeadListItem } from '@/lib/leads/data'
import { LEAD_PERIODS, LEADS_PER_PAGE, leadFiltersQuery, parseLeadFilters, type LeadFilters } from '@/lib/leads/filters'
import { telHref, whatsappHref } from '@/lib/leads/contact'
import { LeadsFiltersBar } from './filters-bar'
import { LeadBadges, LeadStatusBadge } from './lead-badges'
import { MarkAllSeenButton } from './mark-all-seen-button'

// CRM fase 1: listado de leads de la web (docs/spec-crm.md §8.2). Solo con leads.gestionar.
export const dynamic = 'force-dynamic'

const BASE = '/dashboard/crm/leads'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const staff = await getStaffUser()
  if (!staff || !hasPermission(staff.role, 'leads.gestionar')) notFound()

  const filters = parseLeadFilters(await searchParams)
  const admin = createAdminClient()
  const timezone = await getCenterTimezone(admin)
  const today = todayIn(timezone)

  const [{ rows, total }, options, unseen] = await Promise.all([
    listLeads(admin, filters, { today, timezone }),
    getLeadFilterOptions(admin),
    countUnseenLeads(admin),
  ])

  const pages = Math.max(1, Math.ceil(total / LEADS_PER_PAGE))
  const periodLabel = LEAD_PERIODS.find(p => p.key === filters.periodo)!.label.toLowerCase()
  const detailQuery = leadFiltersQuery(filters) // para volver al listado con los mismos filtros
  const hasFilters = !!(filters.etapa || filters.canal || filters.pregunta || filters.q || filters.estado !== 'todos' || filters.spam)

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/40">CRM</p>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-white/50 text-sm mt-1">
            {filters.spam
              ? `${total} ${total === 1 ? 'marcado' : 'marcados'} como spam`
              : `${total} ${total === 1 ? 'lead' : 'leads'} ${filters.periodo === 'todos' ? 'en total' : `(${periodLabel})`}`}
            {' · '}{unseen} sin ver
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {unseen > 0 && <MarkAllSeenButton />}
          <Link href={`${BASE}/nuevo`}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--brand)] hover:opacity-90 text-white text-sm font-semibold px-4 py-2 transition-opacity">
            <Plus className="h-4 w-4" /> Nuevo lead
          </Link>
        </div>
      </div>

      <LeadsFiltersBar filters={filters} options={options} />

      {rows.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-10 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--brand)]/10 flex items-center justify-center mb-4">
            <Inbox className="h-6 w-6 text-[var(--brand)]" />
          </div>
          <h3 className="text-white font-semibold mb-1">
            {hasFilters || filters.periodo !== 'todos' ? 'No hay leads con estos filtros' : 'Todavía no ha llegado ningún contacto desde la web'}
          </h3>
          <p className="text-white/40 text-sm">
            {hasFilters || filters.periodo !== 'todos'
              ? 'Prueba con otro periodo o quita los filtros.'
              : 'Cuando alguien rellene el formulario de la web del centro, aparecerá aquí.'}
          </p>
        </div>
      ) : (
        <>
          {/* Escritorio */}
          <div className="hidden md:block bg-[#1C1C1C] rounded-2xl border border-white/10 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  {['Recibido', 'Nombre', 'Estado', 'Contacto', 'Canal', 'Primera respuesta'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map(l => (
                  <tr key={l.id} className={`hover:bg-white/5 transition-colors ${l.seen_at ? '' : 'bg-[var(--brand)]/[0.04]'}`}>
                    <td className="px-4 py-3 text-sm text-white/50 whitespace-nowrap">{formatDateTimeEs(l.received_at, timezone)}</td>
                    <td className="px-4 py-3">
                      <Link href={`${BASE}/${l.id}${detailQuery}`}
                        className={`text-sm hover:underline ${l.seen_at ? 'text-white' : 'text-white font-semibold'}`}>
                        {l.full_name}
                      </Link>
                      <div className="mt-1">
                        <LeadBadges seen={!!l.seen_at} duplicates={l.duplicates} hasNotes={!!l.internal_notes} manual={l.source === 'manual'} />
                      </div>
                    </td>
                    <td className="px-4 py-3"><LeadStatusBadge status={l.status} /></td>
                    <td className="px-4 py-3 text-sm text-white/70">
                      {l.phone && <div className="whitespace-nowrap">{l.phone}</div>}
                      {l.email && <div className="text-white/50 truncate max-w-[220px]">{l.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60">{l.channel_label ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-white/50 max-w-[280px]"><FirstAnswer lead={l} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil */}
          <ul className="md:hidden flex flex-col gap-2">
            {rows.map(l => <LeadCard key={l.id} lead={l} href={`${BASE}/${l.id}${detailQuery}`} timezone={timezone} />)}
          </ul>

          {pages > 1 && <Pagination filters={filters} pages={pages} />}
        </>
      )}
    </div>
  )
}

function FirstAnswer({ lead }: { lead: LeadListItem }) {
  // La primera respuesta con texto (no un número como la edad), que suele ser la más informativa
  const a = lead.answers.find(x => x.value && !/^[\d\s.,]+$/.test(x.value)) ?? lead.answers.find(x => x.value)
  if (!a) return <>—</>
  return (
    <span className="line-clamp-2" title={`${a.label}: ${a.value}`}>
      <span className="text-white/35">{a.label}: </span>{a.value}
    </span>
  )
}

function LeadCard({ lead, href, timezone }: { lead: LeadListItem; href: string; timezone: string }) {
  const tel = telHref(lead.phone_normalized)
  const wa = whatsappHref(lead.phone_normalized)
  return (
    <li className={`rounded-2xl border p-4 ${lead.seen_at ? 'border-white/10 bg-[#1C1C1C]' : 'border-[var(--brand)]/30 bg-[var(--brand)]/[0.06]'}`}>
      <Link href={href} className="block">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-white ${lead.seen_at ? '' : 'font-semibold'}`}>{lead.full_name}</span>
          <span className="text-xs text-white/40 whitespace-nowrap">{formatDateTimeEs(lead.received_at, timezone)}</span>
        </div>
        <p className="text-sm text-white/50 mt-0.5">{lead.channel_label ?? 'Sin canal'}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <LeadStatusBadge status={lead.status} />
          <LeadBadges seen={!!lead.seen_at} duplicates={lead.duplicates} hasNotes={!!lead.internal_notes} manual={lead.source === 'manual'} />
        </div>
      </Link>
      {(tel || wa) && (
        <div className="flex gap-2 mt-3">
          {tel && (
            <a href={tel} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-white/10 text-white text-sm font-medium py-2">
              <Phone className="h-4 w-4" /> Llamar
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-white/10 text-white text-sm font-medium py-2">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
        </div>
      )}
    </li>
  )
}

function Pagination({ filters, pages }: { filters: LeadFilters; pages: number }) {
  const p = Math.min(filters.pagina, pages)
  const link = (n: number) => BASE + leadFiltersQuery(filters, { pagina: n })
  const cls = 'flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-white/10 bg-[#1C1C1C]'
  return (
    <nav className="flex items-center justify-center gap-3 text-sm text-white/50" aria-label="Páginas">
      {p > 1 ? <Link href={link(p - 1)} className={`${cls} text-white/70 hover:text-white`}><ChevronLeft className="h-4 w-4" /> Anterior</Link>
        : <span className={`${cls} opacity-40`}><ChevronLeft className="h-4 w-4" /> Anterior</span>}
      <span>Página {p} de {pages}</span>
      {p < pages ? <Link href={link(p + 1)} className={`${cls} text-white/70 hover:text-white`}>Siguiente <ChevronRight className="h-4 w-4" /></Link>
        : <span className={`${cls} opacity-40`}>Siguiente <ChevronRight className="h-4 w-4" /></span>}
    </nav>
  )
}
