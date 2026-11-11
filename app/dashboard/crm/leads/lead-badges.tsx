import Link from 'next/link'
import { StickyNote, Repeat, UserCheck, Store } from 'lucide-react'
import type { DuplicateInfo } from '@/lib/leads/duplicates'
import { leadStatusInfo } from '@/lib/leads/status'

// Estado comercial (docs/spec-crm.md §17)
export function LeadStatusBadge({ status }: { status: string }) {
  const s = leadStatusInfo(status)
  return <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}>{s.label}</span>
}

// Avisos de un lead: sin ver, alta en el centro, ya es cliente, ha escrito varias veces, tiene nota.
export function LeadBadges({ seen, duplicates, hasNotes, manual = false, linkClient = false }: {
  seen: boolean
  manual?: boolean
  duplicates: DuplicateInfo
  hasNotes: boolean
  linkClient?: boolean
}) {
  const writes = duplicates.otherLeadIds.length + 1
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {!seen && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--brand)]/15 text-[var(--brand)]">Sin ver</span>}
      {manual && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/70">
          <Store className="h-3 w-3" /> En el centro
        </span>
      )}
      {duplicates.client && (
        linkClient ? (
          <Link href={`/dashboard/clientes/${duplicates.client.id}`}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 hover:underline">
            <UserCheck className="h-3 w-3" /> Ya es cliente
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-300">
            <UserCheck className="h-3 w-3" /> Ya es cliente
          </span>
        )
      )}
      {writes > 1 && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/70">
          <Repeat className="h-3 w-3" /> Ha escrito {writes} veces
        </span>
      )}
      {hasNotes && (
        <span className="inline-flex items-center text-white/40" title="Tiene nota interna" aria-label="Tiene nota interna">
          <StickyNote className="h-3.5 w-3.5" />
        </span>
      )}
    </span>
  )
}
