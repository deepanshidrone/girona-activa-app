import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { ClientCalendar } from './calendar'
import Image from 'next/image'
import Link from 'next/link'

export default async function ClientPage() {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  // Buscar el cliente asociado a este usuario
  const { data: clientData } = await adminSupabase
    .from('clients')
    .select('id, first_name, last_name')
    .eq('user_id', session.user.id)
    .single()

  if (!clientData) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-6">
        <div className="text-center">
          <h2 className="text-lg font-bold text-[#1C1C1C] mb-2">Sin perfil asignado</h2>
          <p className="text-[#666666] text-sm">Contacta con tu entrenador.</p>
        </div>
      </div>
    )
  }

  // Buscar plan activo
  const { data: plan } = await adminSupabase
    .from('training_plans')
    .select('id, level, duration_months, weekly_frequency, session_duration, start_date, end_date')
    .eq('client_id', clientData.id)
    .eq('status', 'active')
    .single()

  if (!plan) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
        <ClientHeader name={clientData.first_name} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-[#FF914D]/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📅</span>
            </div>
            <h2 className="text-lg font-bold text-[#1C1C1C] mb-1">Sin plan activo</h2>
            <p className="text-[#666666] text-sm">Tu entrenador todavía no ha creado tu plan.</p>
          </div>
        </div>
      </div>
    )
  }

  // Buscar sesiones del plan con ejercicios
  const { data: sessions } = await adminSupabase
    .from('plan_sessions')
    .select(`
      id, session_date, notes,
      plan_session_exercises (
        id, sets, reps, weight_kg, notes, order_index,
        exercises (id, name)
      )
    `)
    .eq('plan_id', plan.id)
    .order('session_date')

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex flex-col">
      <ClientHeader name={clientData.first_name} />
      <div className="flex-1 p-4 max-w-lg mx-auto w-full">
        {/* Info plan */}
        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-4 mb-4">
          <p className="text-xs text-[#666666] uppercase tracking-wider font-medium mb-1">Tu plan activo</p>
          <p className="text-[#1C1C1C] font-semibold">
            Nivel {plan.level} · {plan.duration_months} mes{plan.duration_months > 1 ? 'es' : ''} · {plan.weekly_frequency}x/semana · {plan.session_duration} min
          </p>
          <p className="text-xs text-[#666666] mt-1">
            {new Date(plan.start_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
            {' → '}
            {new Date(plan.end_date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Calendario */}
        <ClientCalendar
          sessions={sessions as any ?? []}
          startDate={plan.start_date}
          durationMonths={plan.duration_months}
        />
      </div>
    </div>
  )
}

function ClientHeader({ name }: { name: string }) {
  return (
    <header className="bg-[#1C1C1C] px-4 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full overflow-hidden">
          <Image src="/logo.png" alt="Girona Activa" width={32} height={32} className="object-cover w-full h-full" />
        </div>
        <span className="text-white text-sm font-semibold tracking-wider uppercase" style={{ fontStyle: 'italic' }}>
          GIRONA ACTIVA
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-white/70 text-sm">Hola, {name}</span>
        <Link href="/logout" className="text-white/50 hover:text-white text-xs transition-colors">
          Salir
        </Link>
      </div>
    </header>
  )
}
