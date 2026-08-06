import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Calendar, Dumbbell, ClipboardList } from 'lucide-react'
import { DeleteClientButton } from './delete-button'

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: cliente } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!cliente) notFound()

  const { data: planes } = await supabase
    .from('training_plans')
    .select(`
      id, type, level, status, duration_months, weekly_frequency,
      session_duration, start_date, end_date, created_at,
      plan_sessions (id, session_date, plan_session_exercises (id))
    `)
    .eq('client_id', id)
    .order('created_at', { ascending: false })

  const planActivo = planes?.find(p => p.status === 'active') ?? null
  const planesAnteriores = planes?.filter(p => p.status !== 'active') ?? []

  const edad = cliente.birth_date
    ? Math.floor((Date.now() - new Date(cliente.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  const sexoLabel = cliente.sex === 'male' ? 'Hombre' : cliente.sex === 'female' ? 'Mujer' : 'Otro'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/clientes" className="text-[#666666] hover:text-[#1C1C1C] transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#FF914D]/10 flex items-center justify-center">
            <User className="h-6 w-6 text-[#FF914D]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1C1C1C]">
              {cliente.first_name} {cliente.last_name}
            </h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              cliente.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {cliente.is_active ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex justify-end mb-2">
        <DeleteClientButton clientId={id} clientName={`${cliente.first_name} ${cliente.last_name}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Datos personales */}
        <div className="md:col-span-1 bg-white rounded-2xl border border-[#E5E5E5] p-5">
          <h2 className="font-semibold text-[#1C1C1C] mb-4">Datos personales</h2>
          <dl className="flex flex-col gap-3">
            <DataRow label="Sexo" value={sexoLabel} />
            {edad && <DataRow label="Edad" value={`${edad} años`} />}
            {cliente.birth_date && (
              <DataRow label="Fecha nac." value={new Date(cliente.birth_date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} />
            )}
            {cliente.height_cm && <DataRow label="Altura" value={`${cliente.height_cm} cm`} />}
            {cliente.weight_kg && <DataRow label="Peso" value={`${cliente.weight_kg} kg`} />}
            {cliente.start_date && (
              <DataRow label="Inicio" value={new Date(cliente.start_date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} />
            )}
          </dl>

          {cliente.notes && (
            <div className="mt-4 pt-4 border-t border-[#E5E5E5]">
              <p className="text-xs font-medium text-[#666666] mb-1">Notas</p>
              <p className="text-sm text-[#1C1C1C]">{cliente.notes}</p>
            </div>
          )}
        </div>

        {/* Planes */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Plan activo */}
          <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[#1C1C1C]">Plan activo</h2>
              <div className="flex items-center gap-3">
                {planActivo && (
                  <Link href={`/dashboard/planes/${planActivo.id}/editar`}
                    className="text-sm font-medium text-[#666666] hover:text-[#1C1C1C] transition-colors">
                    Editar
                  </Link>
                )}
                <Link href={`/dashboard/planes/nuevo?client=${id}`}
                  className="text-sm font-medium text-[#FF914D] hover:underline">
                  + Nuevo plan
                </Link>
              </div>
            </div>

            {!planActivo ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Dumbbell className="h-8 w-8 text-[#E5E5E5] mb-2" />
                <p className="text-sm text-[#666666]">Este cliente no tiene plan activo</p>
              </div>
            ) : (
              <PlanCard plan={planActivo} active />
            )}
          </div>

          {/* Historial */}
          {planesAnteriores.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#E5E5E5] p-5">
              <h2 className="font-semibold text-[#1C1C1C] mb-4">Historial de planes</h2>
              <div className="flex flex-col gap-3">
                {planesAnteriores.map(plan => (
                  <PlanCard key={plan.id} plan={plan} active={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <dt className="text-sm text-[#666666]">{label}</dt>
      <dd className="text-sm font-medium text-[#1C1C1C]">{value}</dd>
    </div>
  )
}

function PlanCard({ plan, active }: { plan: any; active: boolean }) {
  const totalSessions = plan.plan_sessions?.length ?? 0
  const totalExercises = plan.plan_sessions?.reduce(
    (acc: number, s: any) => acc + (s.plan_session_exercises?.length ?? 0), 0
  ) ?? 0

  const levelLabel = ['', 'Principiante', 'Intermedio', 'Avanzado'][plan.level] ?? '—'

  return (
    <div className={`rounded-xl p-4 ${active ? 'bg-[#FF914D]/5 border border-[#FF914D]/20' : 'bg-[#F5F5F5]'}`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className={`h-4 w-4 ${active ? 'text-[#FF914D]' : 'text-[#666666]'}`} />
          <span className="font-medium text-[#1C1C1C] text-sm capitalize">{plan.type === 'individual' ? 'Individual' : 'Grupal'} · {levelLabel}</span>
        </div>
        {!active && (
          <span className="text-xs text-[#666666] bg-white px-2 py-0.5 rounded-full border border-[#E5E5E5]">Completado</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-[#666666]">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          <span>{new Date(plan.start_date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })} → {new Date(plan.end_date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Dumbbell className="h-3.5 w-3.5" />
          <span>{totalSessions} sesiones · {totalExercises} ejercicios</span>
        </div>
        <div>
          <span>{plan.duration_months} {plan.duration_months === 1 ? 'mes' : 'meses'} · {plan.weekly_frequency}x/semana</span>
        </div>
        <div>
          <span>{plan.session_duration} min/sesión</span>
        </div>
      </div>
    </div>
  )
}
