import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffUser, hasPermission } from '@/lib/auth/permissions'
import { employeeName, loadKpis } from '@/lib/kpis/load'
import { matchesEmployee } from '@/lib/kpis/compute'
import { monthYearLabel, periodRefDate } from '@/lib/kpis/period'
import { toCsv } from '@/lib/kpis/csv'
import { addMonths } from '@/lib/center'
import { CLIENT_STATE_LABEL, type ClientState } from '@/lib/client-state'

// Exportación a CSV del panel de indicadores (solo admin).
// GET /dashboard/indicadores/exportar?seccion=alertas|entrenadores|clientes|bajas|series&periodo=…

const ALERT_LABEL: Record<string, string> = {
  inactive: 'Inactivo demasiado tiempo',
  plan_ending: 'Plan termina sin renovar',
  low_adherence: 'Adherencia baja',
}

export async function GET(request: NextRequest) {
  const staff = await getStaffUser()
  if (!staff || !hasPermission(staff.role, 'indicadores.ver')) {
    return new NextResponse('No encontrado', { status: 404 })
  }

  const sp = request.nextUrl.searchParams
  const seccion = sp.get('seccion') ?? ''
  const admin = createAdminClient()
  const data = await loadKpis(admin, {
    periodo: sp.get('periodo') ?? undefined,
    comparar: sp.get('comparar') ?? undefined,
    entrenador: sp.get('entrenador') ?? undefined,
    tipo: sp.get('tipo') ?? undefined,
  })
  const periodSlug = data.period.from === data.period.to
    ? data.period.from.slice(0, 7)
    : `${data.period.from.slice(0, 7)}_${data.period.to.slice(0, 7)}`

  let csv: string
  switch (seccion) {
    case 'alertas':
      csv = toCsv(
        ['Alerta', 'Cliente', 'Valor', 'Fecha', 'Entrenador', 'Tipo de plan'],
        data.alerts.map(a => [
          ALERT_LABEL[a.kind] ?? a.kind,
          a.client_name,
          a.kind === 'low_adherence' ? `${a.value} %` : `${a.value} días`,
          a.ref_date,
          employeeName(data, a.employee_id),
          a.plan_type,
        ]),
      )
      break
    case 'entrenadores':
      csv = toCsv(
        ['Entrenador', 'Clientes activos', 'Sesiones impartidas', 'Horas asignadas', 'Horas disponibles', 'Ocupación %', 'Adherencia %', 'Retención %', 'Bajas'],
        data.trainers.map(t => [
          employeeName(data, t.employeeId), t.activeClients, t.imparted, t.hours, t.availHours,
          t.occupancy, t.adherence, t.retention, t.bajas,
        ]),
      )
      break
    case 'clientes': {
      const ref = periodRefDate(data.period, data.today)
      const { data: states } = await admin.rpc('kpi_client_states', { p_date: ref })
      const rows = ((states ?? []) as { client_name: string; state: ClientState; employee_id: string | null; plan_type: string | null; since: string }[])
        .filter(s => matchesEmployee(s.employee_id, data.filters.employee) && (data.filters.type === 'all' || s.plan_type === data.filters.type))
      csv = toCsv(
        ['Cliente', `Estado a ${ref}`, 'Desde', 'Entrenador (último plan)', 'Tipo de plan'],
        rows.map(s => [s.client_name, CLIENT_STATE_LABEL[s.state], s.since, employeeName(data, s.employee_id), s.plan_type]),
      )
      break
    }
    case 'bajas': {
      const lastDay = addMonths(data.period.to, 1)
      const { data: bajas } = await admin
        .from('client_periods')
        .select('ended_on, started_on, clients(first_name, last_name), client_end_reasons(label)')
        .gte('ended_on', data.period.from)
        .lt('ended_on', lastDay)
        .order('ended_on')
      // El comentario de la baja no se exporta: puede contener datos de salud
      csv = toCsv(
        ['Cliente', 'Fecha de alta', 'Fecha de baja', 'Motivo'],
        (bajas ?? []).map(b => {
          type Rel<T> = T | T[] | null
          const cr = b.clients as Rel<{ first_name: string; last_name: string }>
          const rr = b.client_end_reasons as Rel<{ label: string }>
          const c = Array.isArray(cr) ? cr[0] : cr
          const r = Array.isArray(rr) ? rr[0] : rr
          return [c ? `${c.first_name} ${c.last_name}` : '', b.started_on, b.ended_on, r?.label ?? '']
        }),
      )
      break
    }
    case 'series':
      csv = toCsv(
        ['Mes', 'Activos', 'Inactivos', 'Baja', 'Altas nuevas', 'Reactivaciones', 'Bajas', 'Churn %', 'Retención %', 'Adherencia %', 'Ocupación grupal %', 'Ocupación entrenadores %'],
        data.series.map(({ month, snapshot: s }) => [
          monthYearLabel(month), s.clients.active, s.clients.inactive, s.clients.baja,
          s.altas.new, s.altas.reactivation, s.bajas.total, s.churn, s.retention.pct,
          s.adherence, s.groupOcc.pct, s.trainerOcc.pct,
        ]),
      )
      break
    default:
      return new NextResponse('Sección desconocida', { status: 400 })
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="indicadores_${seccion}_${periodSlug}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
