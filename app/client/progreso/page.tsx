import Link from 'next/link'
import { ChevronRight, Flame, Target, CheckCircle2 } from 'lucide-react'
import { getMisSesiones, getPlanes, getPortal } from '@/lib/client-portal/data'
import { completedByMonth, computeAdherence, computeStreaks, countCompleted } from '@/lib/client-portal/stats'
import { monthStart } from '@/lib/center'
import { MonthlyBars } from './monthly-bars'

export const dynamic = 'force-dynamic'

// Progreso personal (sin comparar con otros clientes). docs/spec-vista-cliente.md §4.1.5
export default async function ClientProgressPage() {
  const portal = await getPortal()
  if (!portal?.ficha) return null
  const { today } = portal

  const [sesiones, planes] = await Promise.all([getMisSesiones(), getPlanes()])
  const actual = planes.find(p => p.is_current) ?? null

  const esteMes = countCompleted(sesiones, monthStart(today), today)
  const esteAno = countCompleted(sesiones, today.slice(0, 4) + '-01-01', today)
  const racha = computeStreaks(sesiones, today)
  // Adherencia del plan vigente; sin plan vigente, de todo el historial
  const adherencia = actual
    ? computeAdherence(sesiones, today, actual.start_date, actual.eff_end)
    : computeAdherence(sesiones, today)
  const meses = completedByMonth(sesiones, today, 6)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Progreso</h1>

      <div className="grid grid-cols-2 gap-3">
        <Tile icon={<CheckCircle2 className="h-4 w-4 text-green-400" />} value={esteMes} label="este mes" sub={`${esteAno} este año`} />
        <Tile icon={<Flame className="h-4 w-4 text-[var(--brand)]" />} value={racha.current} label={racha.current === 1 ? 'sesión seguida' : 'sesiones seguidas'} sub={`Récord: ${racha.max}`} />
      </div>

      <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Target className="h-4 w-4 text-white/50" />
          <p className="text-sm text-white/70">{actual ? 'Asistencia a tu plan actual' : 'Asistencia total'}</p>
        </div>
        {adherencia.pct === null ? (
          <p className="text-sm text-white/45">Sin datos todavía.</p>
        ) : (
          <>
            <p className="text-3xl font-bold">{adherencia.pct} %</p>
            <p className="text-xs text-white/45">
              {adherencia.completed} de {adherencia.completed + adherencia.missed} sesiones hasta hoy
            </p>
            <div
              className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden"
              role="img"
              aria-label={`Asistencia ${adherencia.pct} %`}
            >
              <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${adherencia.pct}%` }} />
            </div>
          </>
        )}
      </div>

      <MonthlyBars data={meses} />

      <nav className="bg-[#1C1C1C] rounded-2xl border border-white/10 divide-y divide-white/5">
        <Link href="/client/historial" className="flex items-center justify-between px-4 py-3.5 text-sm active:bg-white/5">
          Historial de sesiones <ChevronRight className="h-4 w-4 text-white/30" />
        </Link>
        <Link href="/client/historial#planes" className="flex items-center justify-between px-4 py-3.5 text-sm active:bg-white/5">
          Tus planes <ChevronRight className="h-4 w-4 text-white/30" />
        </Link>
      </nav>
    </div>
  )
}

function Tile({ icon, value, label, sub }: { icon: React.ReactNode; value: number; label: string; sub: string }) {
  return (
    <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4">
      <div className="mb-2">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-white/55">{label}</p>
      <p className="text-xs text-white/35 mt-1">{sub}</p>
    </div>
  )
}
