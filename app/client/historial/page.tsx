import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getMisSesiones, getPlanes, getPortal } from '@/lib/client-portal/data'
import { capitalizeFirst, formatTimeRange, sessionTypeLabel, type MiPlan } from '@/lib/client-portal/types'
import { formatDateEs } from '@/lib/center'
import { BackButton } from '../sesion/[id]/back-button'
import { EmptyState, StatusBadge } from '../ui'

export const dynamic = 'force-dynamic'

// Historial: sesiones pasadas (más reciente primero) y planes.
export default async function ClientHistoryPage() {
  const portal = await getPortal()
  if (!portal?.ficha) return null
  const { today } = portal

  const [sesiones, planes] = await Promise.all([getMisSesiones(), getPlanes()])
  // Pasadas: antes de hoy, o de hoy si ya no están previstas (completadas, canceladas)
  const pasadas = sesiones
    .filter(s => s.session_date < today || (s.session_date === today && s.status !== 'scheduled'))
    .reverse()

  const porMes = new Map<string, typeof pasadas>()
  for (const s of pasadas) {
    const key = s.session_date.slice(0, 7)
    porMes.set(key, [...(porMes.get(key) ?? []), s])
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <BackButton />
        <h1 className="text-xl font-bold">Historial</h1>
      </div>

      {pasadas.length === 0 ? (
        <EmptyState title="Todavía no hay sesiones pasadas" text="Aquí aparecerán tus sesiones a medida que las vayas haciendo." />
      ) : (
        [...porMes.entries()].map(([month, list]) => (
          <section key={month}>
            <h2 className="text-xs uppercase tracking-wider text-white/40 font-medium mb-2">
              {capitalizeFirst(formatDateEs(month + '-01', { month: 'long', year: 'numeric' }))}
            </h2>
            <ul className="bg-[#1C1C1C] rounded-2xl border border-white/10 divide-y divide-white/5">
              {list.map(s => (
                <li key={s.source_id}>
                  <Link href={`/client/sesion/${s.source_id}`} className="flex items-center gap-3 px-4 py-3 active:bg-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {capitalizeFirst(formatDateEs(s.session_date, { weekday: 'short', day: 'numeric', month: 'short' }))}
                        {s.session_time && <span className="text-white/45"> · {formatTimeRange(s.session_time, null)}</span>}
                      </p>
                      <p className="text-xs text-white/45">{sessionTypeLabel(s)}{s.trainer_name ? ` · ${s.trainer_name}` : ''}</p>
                    </div>
                    <StatusBadge status={s.status} />
                    <ChevronRight className="h-4 w-4 text-white/25 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {planes.length > 0 && (
        <section id="planes">
          <h2 className="text-xs uppercase tracking-wider text-white/40 font-medium mb-2">Tus planes</h2>
          <ul className="flex flex-col gap-2">
            {planes.map(p => <PlanRow key={p.id} plan={p} />)}
          </ul>
        </section>
      )}
    </div>
  )
}

function PlanRow({ plan }: { plan: MiPlan }) {
  const fin = plan.eff_end ?? plan.end_date
  return (
    <li className={`rounded-2xl border p-4 ${plan.is_current ? 'border-[var(--brand)]/30 bg-[var(--brand)]/10' : 'border-white/10 bg-[#1C1C1C]'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-sm">
          {plan.type === 'individual' ? 'Individual' : 'Grupal'}{plan.level ? ` · Nivel ${plan.level}` : ''}
        </p>
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${plan.is_current ? 'bg-[var(--brand)]/15 text-[var(--brand)]' : 'bg-white/5 text-white/45'}`}>
          {plan.is_current ? 'Actual' : 'Terminado'}
        </span>
      </div>
      <p className="text-xs text-white/50 mt-1">
        {formatDateEs(plan.start_date)} → {formatDateEs(fin)}
      </p>
      <p className="text-xs text-white/45 mt-0.5">
        {[plan.weekly_frequency && `${plan.weekly_frequency}×/semana`, plan.session_duration && `${plan.session_duration} min`, plan.trainer_name]
          .filter(Boolean).join(' · ')}
      </p>
    </li>
  )
}
