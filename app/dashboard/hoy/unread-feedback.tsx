import Link from 'next/link'
import { AlertTriangle, MessageSquare, ChevronRight } from 'lucide-react'
import type { StaffFeedback } from '@/app/actions/client-feedback'

// Feedback de clientes sin leer, en la agenda "Hoy" (docs/spec-vista-cliente.md §4.2, P5).
// Una fila por cliente: si alguno de sus comentarios marca dolor, se resalta.
export function UnreadFeedback({ items }: { items: StaffFeedback[] }) {
  if (items.length === 0) return null

  const byClient = new Map<string, { name: string; count: number; pain: StaffFeedback | null; last: StaffFeedback }>()
  for (const f of items) {
    const cur = byClient.get(f.client_id)
    if (!cur) byClient.set(f.client_id, { name: f.client_name, count: 1, pain: f.pain ? f : null, last: f })
    else {
      cur.count++
      if (f.pain && !cur.pain) cur.pain = f
    }
  }
  const rows = [...byClient.entries()].sort((a, b) => Number(!!b[1].pain) - Number(!!a[1].pain))

  return (
    <section className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="h-4 w-4 text-[#FF914D]" />
        <h2 className="font-semibold text-white text-sm">Feedback de clientes sin leer</h2>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map(([clientId, r]) => {
          const f = r.pain ?? r.last
          return (
            <li key={clientId}>
              <Link href={`/dashboard/clientes/${clientId}`}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-colors ${
                  r.pain ? 'border-red-500/30 bg-red-500/10 hover:bg-red-500/15' : 'border-white/5 bg-white/5 hover:bg-white/10'
                }`}>
                {r.pain
                  ? <AlertTriangle className="h-4 w-4 text-red-300 shrink-0" />
                  : <MessageSquare className="h-4 w-4 text-white/30 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {r.name}{r.count > 1 && <span className="text-white/40 font-normal"> · {r.count} comentarios</span>}
                  </p>
                  <p className="text-xs text-white/50 truncate">
                    {f.pain ? `Dolor${f.pain_area ? `: ${f.pain_area}` : ''}` : 'Sin dolor'}
                    {f.comment ? ` · “${f.comment}”` : ''}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/25 shrink-0" />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
