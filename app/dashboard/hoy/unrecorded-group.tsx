import Link from 'next/link'
import { ClipboardList, ChevronRight } from 'lucide-react'
import type { UnrecordedGroupSession } from '@/app/actions/group-session-logs'

// Clases grupales de los últimos 7 días sin pasar lista (agenda "Hoy").
// Mientras no se registren, sus clientes las ven como "Sin registrar" y no
// cuentan en su asistencia ni en los indicadores.
export function UnrecordedGroup({ items }: { items: UnrecordedGroupSession[] }) {
  if (items.length === 0) return null
  return (
    <section className="bg-[#1C1C1C] rounded-2xl border border-[#FF914D]/25 p-4 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList className="h-4 w-4 text-[#FF914D]" />
        <h2 className="font-semibold text-white text-sm">Clases grupales sin pasar lista</h2>
      </div>
      <p className="text-xs text-white/40 mb-3">Últimos 7 días. Sin registro no cuentan en la asistencia de los clientes.</p>
      <ul className="flex flex-col gap-1.5">
        {items.map(s => (
          <li key={s.id}>
            <Link href={`/dashboard/hoy/grupo/${s.id}`}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 border border-white/5 bg-white/5 hover:bg-white/10 transition-colors">
              {s.session_label && (
                <span className="w-6 h-6 rounded-full bg-[#FF914D] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {s.session_label}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">
                  {new Date(s.session_date + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
                  {s.session_time && <span className="text-white/45"> · {s.session_time.slice(0, 5)}</span>}
                </p>
                <p className="text-xs text-white/45 truncate">
                  {s.clients} {s.clients === 1 ? 'cliente' : 'clientes'}{s.employee_name ? ` · ${s.employee_name}` : ''}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/25 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
