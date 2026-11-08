import { getFestivos, getMisSesiones, getPortal } from '@/lib/client-portal/data'
import { monthEnd, monthStart } from '@/lib/center'
import { CalendarView } from './calendar-view'

export const dynamic = 'force-dynamic'

export default async function ClientCalendarPage() {
  const portal = await getPortal()
  if (!portal?.ficha) return null
  const { today } = portal

  const sesiones = await getMisSesiones()
  // Meses navegables: del de la primera sesión al de la última, incluido el actual
  const dates = [today, ...sesiones.map(s => s.session_date)].sort()
  const from = monthStart(dates[0])
  const to = monthEnd(dates[dates.length - 1])
  const festivos = await getFestivos(from, to)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Calendario</h1>
      <CalendarView
        sesiones={sesiones.map(s => ({
          source_id: s.source_id,
          session_date: s.session_date,
          session_time: s.session_time,
          duration_min: s.duration_min,
          type: s.type,
          session_label: s.session_label,
          status: s.status,
        }))}
        festivos={festivos}
        today={today}
        firstMonth={from.slice(0, 7)}
        lastMonth={to.slice(0, 7)}
      />
    </div>
  )
}
