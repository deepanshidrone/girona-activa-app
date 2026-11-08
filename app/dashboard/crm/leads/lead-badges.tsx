import Link from 'next/link'
import { StickyNote, Repeat, UserCheck } from 'lucide-react'
import type { DuplicateInfo } from '@/lib/leads/duplicates'

// Avisos de un lead: nuevo, ya es cliente, ha escrito varias veces, tiene nota.
export function LeadBadges({ seen, duplicates, hasNotes, linkClient = false }: {
  seen: boolean
  duplicates: DuplicateInfo
  hasNotes: boolean
  linkClient?: boolean
}) {
  const writes = duplicates.otherLeadIds.length + 1
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {!seen && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--brand)]/15 text-[var(--brand)]">Nuevo</span>}
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
