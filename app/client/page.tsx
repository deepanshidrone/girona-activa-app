import { Flame, CheckCircle2 } from 'lucide-react'
import { getEjercicios, getMisSesiones, getPortal } from '@/lib/client-portal/data'
import { computeStreaks, countCompleted } from '@/lib/client-portal/stats'
import { formatDateEs, monthStart } from '@/lib/center'
import { capitalizeFirst } from '@/lib/client-portal/types'
import { EmptyState, Notice, SessionCard } from './ui'

export const dynamic = 'force-dynamic'

// Hoy: la sesión de hoy o, si no hay, la próxima. Resumen de progreso.
export default async function ClientTodayPage() {
  const portal = await getPortal()
  if (!portal?.ficha) return null
  const { ficha, today } = portal

  const sesiones = await getMisSesiones()
  const hoy = sesiones.filter(s => s.session_date === today && s.status !== 'cancelled')
  const proxima = hoy.length ? null : sesiones.find(s => s.session_date > today && s.status === 'scheduled') ?? null
  const mostrar = hoy.length ? hoy : proxima ? [proxima] : []
  const ejercicios = await getEjercicios(mostrar.map(s => s.source_id))

  const { current: racha } = computeStreaks(sesiones, today)
  const esteMes = countCompleted(sesiones, monthStart(today), today)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-white/40 font-medium">Hoy</p>
        <h1 className="text-xl font-bold">
          {capitalizeFirst(formatDateEs(today, { weekday: 'long', day: 'numeric', month: 'long' }))}
        </h1>
      </div>

      {ficha.state === 'baja' && <Notice>No tienes un plan activo. Habla con tu centro.</Notice>}

      {hoy.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-white/70">{hoy.length > 1 ? 'Tus sesiones de hoy' : 'Tu sesión de hoy'}</h2>
          {hoy.map(s => (
            <SessionCard key={s.source_id} sesion={s} ejercicios={ejercicios.filter(e => e.source_id === s.source_id)} />
          ))}
        </section>
      )}

      {proxima && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-white/70">
            Hoy no tienes sesión · Próxima:{' '}
            <span className="text-white">{formatDateEs(proxima.session_date, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
          </h2>
          <SessionCard sesion={proxima} ejercicios={ejercicios} />
        </section>
      )}

      {mostrar.length === 0 && ficha.state !== 'baja' && (
        <EmptyState title="Sin sesiones previstas" text="Tu entrenador está preparando tu plan." />
      )}

      <section className="grid grid-cols-2 gap-3">
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4">
          <CheckCircle2 className="h-4 w-4 text-green-400 mb-2" />
          <p className="text-2xl font-bold">{esteMes}</p>
          <p className="text-xs text-white/45">{esteMes === 1 ? 'sesión este mes' : 'sesiones este mes'}</p>
        </div>
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4">
          <Flame className="h-4 w-4 text-[var(--brand)] mb-2" />
          <p className="text-2xl font-bold">{racha}</p>
          <p className="text-xs text-white/45">{racha === 1 ? 'sesión seguida' : 'sesiones seguidas'}</p>
        </div>
      </section>
    </div>
  )
}
