import { Suspense, type ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Download, XCircle, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffUser, hasPermission } from '@/lib/auth/permissions'
import { employeeName, loadKpis, type KpiData } from '@/lib/kpis/load'
import { trafficLight, type TrafficLight } from '@/lib/kpis/compute'
import { fmtDelta, fmtHours, fmtNum, fmtPct } from '@/lib/kpis/format'
import { monthLabel } from '@/lib/kpis/period'
import { formatDateEs } from '@/lib/center'
import { EmptyChart, HBars, Heatmap, PercentLine, Sparkline, StackedColumns, VIZ, WeekTargetChart } from '@/components/kpis/charts'
import { FiltersBar } from './filters-bar'
import { TargetsPanel } from './targets-panel'

// Panel de indicadores del centro, solo admin (docs/spec-kpis.md).
export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

const TABS = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'ocupacion', label: 'Ocupación' },
  { key: 'entrenadores', label: 'Entrenadores' },
  { key: 'progreso', label: 'Progreso' },
] as const
type TabKey = (typeof TABS)[number]['key']

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default async function IndicadoresPage({ searchParams }: { searchParams: SearchParams }) {
  const staff = await getStaffUser()
  if (!staff || !hasPermission(staff.role, 'indicadores.ver')) notFound()

  const sp = await searchParams
  const params = { periodo: one(sp.periodo), comparar: one(sp.comparar), entrenador: one(sp.entrenador), tipo: one(sp.tipo) }
  const tab: TabKey = TABS.some(t => t.key === one(sp.tab)) ? (one(sp.tab) as TabKey) : 'resumen'

  const data = await loadKpis(createAdminClient(), params)

  // Query string sin la pestaña, para los enlaces de pestañas y exportación
  const base = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) base.set(k, v)
  const tabHref = (key: TabKey) => {
    const q = new URLSearchParams(base)
    if (key !== 'resumen') q.set('tab', key)
    const s = q.toString()
    return s ? `/dashboard/indicadores?${s}` : '/dashboard/indicadores'
  }
  const csvHref = (seccion: string) => {
    const q = new URLSearchParams(base)
    q.set('seccion', seccion)
    return `/dashboard/indicadores/exportar?${q.toString()}`
  }

  const hasUnassigned = data.trainers.some(t => t.employeeId === null)

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-5 max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Indicadores</h1>
          <p className="text-white/50 text-sm mt-1">Cómo va el centro y qué conviene revisar</p>
        </div>
        {staff.role === 'admin' && <TargetsPanel targets={data.targets} />}
      </div>

      <Suspense>
        <FiltersBar
          employees={data.employees.map(e => ({ id: e.id, name: e.name }))}
          hasUnassigned={hasUnassigned}
          periodLabel={capitalize(data.period.label)}
          comparisonLabel={data.comparison.label}
        />
      </Suspense>

      <nav className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-white/10" aria-label="Secciones">
        {TABS.map(t => (
          <Link key={t.key} href={tabHref(t.key)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-[#FF914D] text-white' : 'border-transparent text-white/50 hover:text-white'
            }`}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === 'resumen' && <Resumen data={data} tabHref={tabHref} csvHref={csvHref} />}
      {tab === 'clientes' && <Clientes data={data} csvHref={csvHref} />}
      {tab === 'ocupacion' && <Ocupacion data={data} />}
      {tab === 'entrenadores' && <Entrenadores data={data} csvHref={csvHref} />}
      {tab === 'progreso' && <Progreso data={data} />}
    </div>
  )
}

// ── Piezas comunes ──────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function Card({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-white/40 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function CsvLink({ href, label = 'CSV' }: { href: string; label?: string }) {
  return (
    <a href={href} className="flex items-center gap-1 text-xs text-white/50 hover:text-white shrink-0">
      <Download className="h-3.5 w-3.5" />
      {label}
    </a>
  )
}

const LIGHT: Record<TrafficLight, { label: string; color: string; Icon: typeof CheckCircle2 }> = {
  good: { label: 'En objetivo', color: VIZ.good, Icon: CheckCircle2 },
  warning: { label: 'Cerca del límite', color: VIZ.warning, Icon: AlertTriangle },
  critical: { label: 'Fuera de objetivo', color: VIZ.critical, Icon: XCircle },
}

function Tile({
  label, value, delta, goodWhenUp = true, light, spark, href, note, targetText,
}: {
  label: string
  value: string
  delta?: { text: string; dir: 'up' | 'down' | 'flat' } | null
  goodWhenUp?: boolean | null
  light?: TrafficLight | null
  spark?: (number | null)[]
  href?: string
  note?: string
  targetText?: string
}) {
  const deltaGood = delta && delta.dir !== 'flat' && goodWhenUp !== null ? (delta.dir === 'up') === goodWhenUp : null
  const DeltaIcon = delta?.dir === 'up' ? ArrowUpRight : delta?.dir === 'down' ? ArrowDownRight : Minus
  const content = (
    <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4 h-full flex flex-col gap-1 hover:border-[#FF914D]/50 transition-colors">
      <p className="text-sm text-white/50">{label}</p>
      <p className="text-3xl font-semibold text-white">{value}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs min-h-4">
        {delta && (
          <span className={`flex items-center gap-0.5 ${deltaGood === null ? 'text-white/50' : deltaGood ? 'text-[#0ca30c]' : 'text-[#e66767]'}`}>
            <DeltaIcon className="h-3.5 w-3.5" />
            {delta.text}
          </span>
        )}
        {light && (
          <span className="flex items-center gap-1 text-white/70">
            {(() => { const L = LIGHT[light]; return <L.Icon className="h-3.5 w-3.5" style={{ color: L.color }} /> })()}
            {LIGHT[light].label}
          </span>
        )}
        {targetText && <span className="text-white/40">{targetText}</span>}
      </div>
      {note && <p className="text-xs text-white/40">{note}</p>}
      {spark && <div className="mt-auto pt-2"><Sparkline values={spark} /></div>}
    </div>
  )
  return href ? <Link href={href} className="block h-full">{content}</Link> : content
}

function targetText(data: KpiData, key: string): string | undefined {
  const t = data.targets.find(x => x.key === key)
  if (!t) return undefined
  if (t.value_min !== null && t.value_max !== null) return `obj. ${fmtNum(t.value_min)}–${fmtNum(t.value_max)} ${t.unit}`
  if (t.value_min !== null) return `obj. ≥ ${fmtNum(t.value_min)} ${t.unit}`
  if (t.value_max !== null) return `obj. ≤ ${fmtNum(t.value_max)} ${t.unit}`
  return undefined
}

function target(data: KpiData, key: string) {
  return data.targets.find(t => t.key === key)
}

const monthsShort = (data: KpiData) => data.series.map(p => monthLabel(p.month, true))

// ── Resumen ─────────────────────────────────────────────────────────────────

function Resumen({ data, tabHref, csvHref }: { data: KpiData; tabHref: (k: TabKey) => string; csvHref: (s: string) => string }) {
  const c = data.current
  const p = data.previous
  const s = data.series.map(x => x.snapshot)
  const noClients = 'Sin clientes en el periodo'

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <Tile label="Clientes activos" href={tabHref('clientes')}
          value={c.hasClients ? fmtNum(c.clients.active) : '—'}
          note={c.hasClients ? `${fmtNum(c.clients.inactive)} inactivos · ${fmtNum(c.clients.baja)} de baja` : noClients}
          delta={c.hasClients && p.hasClients ? fmtDelta(c.clients.active, p.clients.active, 'count') : null}
          spark={s.map(x => (x.hasClients ? x.clients.active : null))} />
        <Tile label="Altas" href={tabHref('clientes')}
          value={fmtNum(c.altas.total)}
          note={`${fmtNum(c.altas.new)} nuevas · ${fmtNum(c.altas.reactivation)} reactivaciones`}
          delta={fmtDelta(c.altas.total, p.altas.total, 'count')}
          spark={s.map(x => x.altas.total)} />
        <Tile label="Bajas" href={tabHref('clientes')} goodWhenUp={false}
          value={fmtNum(c.bajas.total)}
          note={c.bajas.byReason[0] ? `Motivo principal: ${c.bajas.byReason[0].reason}` : undefined}
          delta={fmtDelta(c.bajas.total, p.bajas.total, 'count')}
          spark={s.map(x => x.bajas.total)} />
        <Tile label="Churn mensual" href={tabHref('clientes')} goodWhenUp={false}
          value={fmtPct(c.churn, 1)}
          light={trafficLight(c.churn, target(data, 'churn_max'))}
          targetText={targetText(data, 'churn_max')}
          note={c.churn === null ? 'Sin clientes de alta al empezar el mes' : undefined}
          delta={fmtDelta(c.churn, p.churn, 'pct')}
          spark={s.map(x => x.churn)} />
        <Tile label="Retención (renovación)" href={tabHref('clientes')}
          value={fmtPct(c.retention.pct)}
          light={trafficLight(c.retention.pct, target(data, 'retention_min'))}
          targetText={targetText(data, 'retention_min')}
          note={c.retention.pct === null ? 'Ningún plan ha terminado en el periodo' : c.retention.pending ? `${fmtNum(c.retention.pending)} ${c.retention.pending === 1 ? 'plan pendiente' : 'planes pendientes'} de la ventana de renovación` : undefined}
          delta={fmtDelta(c.retention.pct, p.retention.pct, 'pct')}
          spark={s.map(x => x.retention.pct)} />
        <Tile label="Adherencia" href={tabHref('clientes')}
          value={fmtPct(c.adherence)}
          light={trafficLight(c.adherence, target(data, 'adherence_min'))}
          targetText={targetText(data, 'adherence_min')}
          note={c.adherence === null ? 'No hay sesiones pasadas en el periodo' : c.sessions.unrecorded ? `${fmtNum(c.sessions.unrecorded)} plazas grupales sin asistencia registrada (no cuentan)` : undefined}
          delta={fmtDelta(c.adherence, p.adherence, 'pct')}
          spark={s.map(x => x.adherence)} />
        <Tile label="Ocupación grupal" href={tabHref('ocupacion')}
          value={fmtPct(c.groupOcc.pct)}
          light={trafficLight(c.groupOcc.pct, target(data, 'group_occupancy_min'))}
          targetText={targetText(data, 'group_occupancy_min')}
          note={c.groupOcc.pct === null ? 'No hay sesiones grupales en el periodo' : `${fmtNum(c.groupOcc.booked)} de ${fmtNum(c.groupOcc.seats)} plazas`}
          delta={fmtDelta(c.groupOcc.pct, p.groupOcc.pct, 'pct')}
          spark={s.map(x => x.groupOcc.pct)} />
        <Tile label="Ocupación entrenadores" href={tabHref('entrenadores')} goodWhenUp={null}
          value={fmtPct(c.trainerOcc.pct)}
          light={trafficLight(c.trainerOcc.pct, target(data, 'trainer_occupancy_range'))}
          targetText={targetText(data, 'trainer_occupancy_range')}
          note={c.trainerOcc.pct === null ? 'Configura las horas semanales en la ficha de cada empleado' : `${fmtHours(c.trainerOcc.minutesWithAvail)} de ${fmtHours(c.trainerOcc.availMinutes)}`}
          delta={fmtDelta(c.trainerOcc.pct, p.trainerOcc.pct, 'pct')}
          spark={s.map(x => x.trainerOcc.pct)} />
        <Tile label="Clientes que progresan" href={tabHref('progreso')}
          value={fmtPct(data.progress.upPct)}
          note={data.progress.upPct === null ? 'Sin cargas registradas para comparar' : `${fmtNum(data.progress.up)} suben carga · ${fmtNum(data.progress.down)} bajan`}
          delta={fmtDelta(data.progress.upPct, data.progressPrev.upPct, 'pct')} />
      </div>

      <Card title="Alertas para actuar" subtitle={`A fecha de hoy (${formatDateEs(data.today)})`} action={<CsvLink href={csvHref('alertas')} />}>
        <Alerts data={data} />
      </Card>
    </div>
  )
}

const ALERT_GROUPS = [
  { kind: 'inactive', title: 'Inactivos hace demasiado', key: 'alert_inactive_days', unit: (v: number) => `${fmtNum(v)} días sin plan` },
  { kind: 'plan_ending', title: 'Planes que terminan sin renovar', key: 'alert_plan_end_days', unit: (v: number) => (v === 0 ? 'termina hoy' : `termina en ${fmtNum(v)} días`) },
  { kind: 'low_adherence', title: 'Adherencia baja (últimos 30 días)', key: 'alert_adherence_min', unit: (v: number) => `${fmtNum(v)} %` },
] as const

function Alerts({ data }: { data: KpiData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {ALERT_GROUPS.map(g => {
        // Lo más urgente primero: más días inactivo, menos días para el fin, menor adherencia
        const items = data.alerts
          .filter(a => a.kind === g.kind)
          .sort((a, b) => g.kind === 'inactive' ? Number(b.value) - Number(a.value) : Number(a.value) - Number(b.value))
        return (
          <div key={g.kind}>
            <p className="text-sm text-white mb-2 flex items-center gap-2">
              {items.length > 0
                ? <AlertTriangle className="h-4 w-4" style={{ color: VIZ.warning }} />
                : <CheckCircle2 className="h-4 w-4" style={{ color: VIZ.good }} />}
              {g.title}
              <span className="text-white/40">({fmtNum(items.length)})</span>
            </p>
            {items.length === 0 ? (
              <p className="text-xs text-white/40">Nada que revisar.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
                {items.map(a => (
                  <li key={a.client_id + a.kind}>
                    <Link href={`/dashboard/clientes/${a.client_id}`} className="flex justify-between gap-2 text-xs rounded-lg px-2 py-1.5 hover:bg-white/5">
                      <span className="text-white truncate">{a.client_name}</span>
                      <span className="text-white/50 shrink-0">{g.unit(Number(a.value))}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Clientes ────────────────────────────────────────────────────────────────

function Clientes({ data, csvHref }: { data: KpiData; csvHref: (s: string) => string }) {
  const labels = monthsShort(data)
  const s = data.series.map(x => x.snapshot)
  const churnT = target(data, 'churn_max')
  const retT = target(data, 'retention_min')
  const adhT = target(data, 'adherence_min')
  const c = data.current

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Clientes por estado" subtitle="Al final de cada mes · últimos 12 meses" action={<CsvLink href={csvHref('clientes')} />}>
        <StackedColumns labels={labels} emptyMessage="Aún no hay clientes en estos meses"
          series={[
            { label: 'Activos', values: s.map(x => x.clients.active) },
            { label: 'Inactivos', values: s.map(x => x.clients.inactive) },
            { label: 'Baja', values: s.map(x => x.clients.baja) },
          ]} />
      </Card>
      <Card title="Altas" subtitle="Nuevas y reactivaciones por mes" action={<CsvLink href={csvHref('series')} label="CSV 12 meses" />}>
        <StackedColumns labels={labels} emptyMessage="No hay altas en estos meses"
          series={[
            { label: 'Nuevas', values: s.map(x => x.altas.new) },
            { label: 'Reactivaciones', values: s.map(x => x.altas.reactivation) },
          ]} />
      </Card>
      <Card title="Bajas por motivo" subtitle={`${capitalize(data.period.label)} · ${fmtNum(c.bajas.total)} bajas`} action={<CsvLink href={csvHref('bajas')} />}>
        <HBars emptyMessage="No hay bajas en el periodo" items={c.bajas.byReason.map(r => ({ label: r.reason, value: r.n }))} />
      </Card>
      <Card title="Churn mensual" subtitle="Bajas del mes ÷ clientes de alta el día 1">
        <PercentLine labels={labels} title="Churn" values={s.map(x => x.churn)}
          target={churnT ? { min: null, max: churnT.value_max } : undefined}
          emptyMessage="Sin clientes de alta al empezar estos meses" />
      </Card>
      <Card title="Retención (renovación)" subtitle={`Planes terminados que se renuevan en ${fmtNum(target(data, 'renewal_window_days')?.value_min ?? 14)} días o menos`}>
        <PercentLine labels={labels} title="Retención" values={s.map(x => x.retention.pct)}
          target={retT ? { min: retT.value_min, max: null } : undefined}
          emptyMessage="Ningún plan ha terminado en estos meses" />
        <p className="text-xs text-white/40 mt-2">
          En el periodo: {fmtNum(c.retention.renewed)} renovados · {fmtNum(c.retention.notRenewed)} sin renovar · {fmtNum(c.retention.pending)} pendientes de la ventana
        </p>
      </Card>
      <Card title="Adherencia" subtitle="Sesiones completadas ÷ sesiones programadas hasta hoy">
        <PercentLine labels={labels} title="Adherencia" values={s.map(x => x.adherence)}
          target={adhT ? { min: adhT.value_min, max: null } : undefined}
          emptyMessage="Aún no hay sesiones registradas" />
        <p className="text-xs text-white/40 mt-2">
          En el periodo: {fmtNum(c.sessions.completed)} completadas · {fmtNum(c.sessions.missed)} no asistidas · {fmtNum(c.sessions.scheduled)} pendientes
          {c.sessions.unrecorded > 0 && ` · ${fmtNum(c.sessions.unrecorded)} plazas grupales sin asistencia registrada (no cuentan)`}
        </p>
      </Card>
    </div>
  )
}

// ── Ocupación ───────────────────────────────────────────────────────────────

function Ocupacion({ data }: { data: KpiData }) {
  const labels = monthsShort(data)
  const s = data.series.map(x => x.snapshot)
  const occT = target(data, 'group_occupancy_min')
  const c = data.current
  const groupOnlyMsg = data.filters.type === 'individual' ? 'No aplica a planes individuales' : null

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Ocupación grupal por franja" subtitle={`${capitalize(data.period.label)} · ${fmtNum(c.groupOcc.booked)} de ${fmtNum(c.groupOcc.seats)} plazas`}>
        <Heatmap cells={data.heatmap} emptyMessage={groupOnlyMsg ?? 'No hay sesiones grupales en el periodo'} />
        <p className="text-xs text-white/40 mt-3">
          Asistencia real en sesiones registradas: {c.groupOcc.attPct === null ? 'sin datos (aún no se registra la asistencia grupal)' : `${fmtPct(c.groupOcc.attPct)} (${fmtNum(c.groupOcc.attended)} de ${fmtNum(c.groupOcc.recordedBooked)} apuntados)`}
        </p>
      </Card>
      <Card title="Evolución de la ocupación grupal" subtitle="Plazas ocupadas ÷ plazas ofertadas">
        <PercentLine labels={labels} title="Ocupación grupal" values={s.map(x => x.groupOcc.pct)}
          target={occT ? { min: occT.value_min, max: null } : undefined}
          emptyMessage={groupOnlyMsg ?? 'No hay sesiones grupales en estos meses'} />
      </Card>
      <Card title="Horas asignadas por entrenador" subtitle={`${capitalize(data.period.label)} · sesiones individuales y grupales`}>
        <HBars emptyMessage="No hay sesiones asignadas en el periodo" decimals={1} suffix=" h"
          items={data.trainers.filter(t => t.hours > 0).map(t => ({
            label: employeeName(data, t.employeeId),
            value: t.hours,
            note: t.occupancy !== null ? `· ${fmtPct(t.occupancy)}` : t.employeeId ? '· sin horas configuradas' : undefined,
          }))} />
      </Card>
      <Card title="Ocupación de entrenadores" subtitle="Horas asignadas ÷ horas disponibles">
        <PercentLine labels={labels} title="Ocupación" values={s.map(x => x.trainerOcc.pct)}
          target={(() => { const t = target(data, 'trainer_occupancy_range'); return t ? { min: t.value_min, max: t.value_max } : undefined })()}
          emptyMessage="Configura las horas semanales en la ficha de cada empleado" />
      </Card>
    </div>
  )
}

// ── Entrenadores ────────────────────────────────────────────────────────────

function Entrenadores({ data, csvHref }: { data: KpiData; csvHref: (s: string) => string }) {
  const range = target(data, 'trainer_occupancy_range')
  return (
    <Card title="Entrenadores" subtitle={`${capitalize(data.period.label)} · los clientes se atribuyen al entrenador de su último plan`} action={<CsvLink href={csvHref('entrenadores')} />}>
      {data.trainers.length === 0 ? (
        <EmptyChart message="No hay entrenadores" height={100} />
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-xs text-white/40 border-b border-white/10">
                <th className="py-2 pr-3 font-medium">Entrenador</th>
                <th className="py-2 px-3 font-medium text-right">Clientes activos</th>
                <th className="py-2 px-3 font-medium text-right">Sesiones impartidas</th>
                <th className="py-2 px-3 font-medium text-right">Horas</th>
                <th className="py-2 px-3 font-medium text-right">Ocupación</th>
                <th className="py-2 px-3 font-medium text-right">Adherencia</th>
                <th className="py-2 px-3 font-medium text-right">Retención</th>
                <th className="py-2 pl-3 font-medium text-right">Bajas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 tabular-nums">
              {data.trainers.map(t => {
                const light = trafficLight(t.occupancy, range)
                return (
                  <tr key={t.employeeId ?? 'none'}>
                    <td className="py-2.5 pr-3 text-white">{employeeName(data, t.employeeId)}</td>
                    <td className="py-2.5 px-3 text-right text-white/80">{fmtNum(t.activeClients)}</td>
                    <td className="py-2.5 px-3 text-right text-white/80">{fmtNum(t.imparted)}</td>
                    <td className="py-2.5 px-3 text-right text-white/80">
                      {fmtNum(t.hours, 1)}{t.availHours !== null && <span className="text-white/40"> / {fmtNum(t.availHours, 1)}</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right text-white/80">
                      {t.occupancy === null ? (
                        <span className="text-white/40">{t.employeeId ? 'sin horas' : '—'}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          {light && (() => { const L = LIGHT[light]; return <L.Icon className="h-3.5 w-3.5" style={{ color: L.color }} aria-label={L.label} /> })()}
                          {fmtPct(t.occupancy)}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-white/80">{fmtPct(t.adherence)}</td>
                    <td className="py-2.5 px-3 text-right text-white/80">{fmtPct(t.retention)}</td>
                    <td className="py-2.5 pl-3 text-right text-white/80">{fmtNum(t.bajas)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-white/40 mt-3">
        Las horas disponibles salen de las horas semanales de la ficha de cada empleado. &quot;—&quot; significa sin datos en el periodo.
      </p>
    </Card>
  )
}

// ── Progreso ────────────────────────────────────────────────────────────────

function Progreso({ data }: { data: KpiData }) {
  const pr = data.progress
  const weeks = data.weekTargets.map(w => ({ ...w, row: data.current.rpeByWeek.find(r => r.week === w.week) }))
  const noGroup = data.filters.type === 'individual'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Progresión de carga" subtitle="Carga media de las últimas 4 semanas frente a las 4 anteriores, por ejercicio">
        <HBars emptyMessage="Aún no hay cargas registradas para comparar"
          items={pr.up + pr.flat + pr.down === 0 ? [] : [
            { label: 'Suben carga (> +2 %)', value: pr.up },
            { label: 'Mantienen', value: pr.flat },
            { label: 'Bajan carga (< −2 %)', value: pr.down },
          ]} />
        <p className="text-xs text-white/40 mt-3">
          {fmtNum(pr.nodata)} clientes sin datos suficientes (necesitan cargas registradas en las dos ventanas).
        </p>
      </Card>
      <Card title="Dolor reportado" subtitle="% de sesiones con feedback en las que el cliente marcó dolor">
        {data.pain.total === 0 ? (
          <EmptyChart height={120} message="Aún no hay feedback de clientes en este periodo (lo dejan desde la app tras cada sesión)" />
        ) : (() => {
          // Menos dolor es mejor: una subida se pinta en rojo
          const d = fmtDelta(data.pain.pct, data.painPrev.pct, 'pct')
          const DIcon = d?.dir === 'up' ? ArrowUpRight : d?.dir === 'down' ? ArrowDownRight : Minus
          const color = !d || d.dir === 'flat' ? 'text-white/50' : d.dir === 'up' ? 'text-[#e66767]' : 'text-[#0ca30c]'
          return (
            <div className="flex flex-col gap-1">
              <p className="text-3xl font-semibold text-white">{fmtPct(data.pain.pct)}</p>
              <p className="text-sm text-white/60">
                {fmtNum(data.pain.withPain)} de {fmtNum(data.pain.total)} sesiones con feedback marcaron dolor
              </p>
              {d && (
                <p className={`flex items-center gap-0.5 text-xs ${color}`}>
                  <DIcon className="h-3.5 w-3.5" /> {d.text} frente al periodo de comparación
                </p>
              )}
              <p className="text-xs text-white/40 mt-2">
                Detalle por cliente en su ficha y en la agenda “Hoy”. Es un dato de salud: no se exporta.
              </p>
            </div>
          )
        })()}
      </Card>
      <Card title="RPE frente al objetivo del ciclo" subtitle="Media por semana del ciclo · sesiones grupales registradas">
        <WeekTargetChart metric="RPE"
          emptyMessage={noGroup ? 'No aplica a planes individuales' : 'Aún no hay sesiones grupales registradas'}
          weeks={weeks.map(w => ({ week: w.week, phase: w.phase_name, actual: w.row?.rpe ?? null, min: Number(w.rpe_min), max: Number(w.rpe_max) }))} />
      </Card>
      <Card title="RIR frente al objetivo del ciclo" subtitle="Media por semana del ciclo · sesiones grupales registradas">
        <WeekTargetChart metric="RIR"
          emptyMessage={noGroup ? 'No aplica a planes individuales' : 'Aún no hay sesiones grupales registradas'}
          weeks={weeks.map(w => ({ week: w.week, phase: w.phase_name, actual: w.row?.rir ?? null, min: Number(w.rir_min), max: Number(w.rir_max) }))} />
      </Card>
    </div>
  )
}
