import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EditPlanCalendar } from './edit-plan-calendar'

export default async function EditarPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: plan } = await supabase
    .from('training_plans')
    .select(`
      id, start_date, end_date, duration_months, client_id,
      clients (first_name, last_name),
      plan_sessions (
        id, session_date, notes,
        plan_session_exercises (
          id, sets, reps, weight_kg, notes, order_index,
          exercises (id, name)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (!plan) notFound()

  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name')
    .order('name')

  const sessions = (plan.plan_sessions ?? []).map((s: any) => ({
    ...s,
    plan_session_exercises: (s.plan_session_exercises ?? []).sort(
      (a: any, b: any) => a.order_index - b.order_index
    ),
  }))

  const client = plan.clients as any

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/dashboard/clientes/${plan.client_id}`} className="text-[#666666] hover:text-[#1C1C1C] transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]">Editar plan</h1>
          <p className="text-sm text-[#666666]">{client?.first_name} {client?.last_name}</p>
        </div>
      </div>

      <EditPlanCalendar
        planId={id}
        sessions={sessions}
        startDate={plan.start_date}
        durationMonths={plan.duration_months}
        allExercises={exercises ?? []}
      />
    </div>
  )
}
