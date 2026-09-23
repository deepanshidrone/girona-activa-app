import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ScreenDisplay from './screen-display'

export const dynamic = 'force-dynamic'

// Reuse the same data-fetching logic as the API route
async function getInitialSessionData(screenId: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('supabase.co', 'vercel.app') || ''}/pantalla/${screenId}/data`,
    { cache: 'no-store' }
  ).catch(() => null)

  // Direct DB fetch if internal fetch fails (during SSR)
  const adminSupabase = createAdminClient()

  const { data: assignment } = await adminSupabase
    .from('screen_assignments')
    .select('*')
    .eq('screen_id', screenId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (!assignment) return null

  if (assignment.session_type === 'individual' && assignment.plan_session_id && assignment.client_id) {
    const [{ data: planSession }, { data: client }, { data: assignedEmployee }] = await Promise.all([
      adminSupabase
        .from('plan_sessions')
        .select(`
          session_date,
          training_plans (name, assigned_employee_id),
          plan_session_exercises (
            id, sets, reps, weight_kg, notes, order_index,
            exercises (id, name)
          )
        `)
        .eq('id', assignment.plan_session_id)
        .single(),
      adminSupabase
        .from('profiles')
        .select('full_name')
        .eq('id', assignment.client_id)
        .single(),
      adminSupabase
        .from('profiles')
        .select('full_name')
        .eq('id', assignment.assigned_by)
        .single(),
    ])

    const plan: any = Array.isArray(planSession?.training_plans)
      ? planSession?.training_plans[0]
      : planSession?.training_plans

    const rawExercises = (planSession?.plan_session_exercises ?? []) as any[]
    const exercises = rawExercises
      .sort((a: any, b: any) => a.order_index - b.order_index)
      .map((pse: any, idx: number) => {
        const ex = Array.isArray(pse.exercises) ? pse.exercises[0] : pse.exercises
        return {
          id: pse.id,
          name: ex?.name ?? '—',
          sets: pse.sets,
          reps: pse.reps,
          weight_kg: pse.weight_kg ?? null,
          notes: pse.notes ?? null,
          order_index: idx,
          block_label: null,
        }
      })

    return {
      type: 'individual' as const,
      clientName: client?.full_name ?? 'Cliente',
      sessionDate: planSession?.session_date ?? '',
      employeeName: assignedEmployee?.full_name ?? 'Entrenador',
      planName: plan?.name ?? "Pla d'entrenament",
      exercises,
    }
  }

  return null
}

export default async function PantallaPage({
  params,
  searchParams,
}: {
  params: { screenId: string }
  searchParams: { token?: string }
}) {
  const { screenId } = await params
  const { token } = await searchParams

  if (!token) notFound()

  const adminSupabase = createAdminClient()
  const { data: screen } = await adminSupabase
    .from('screens')
    .select('id, access_token')
    .eq('id', screenId)
    .eq('access_token', token)
    .single()

  if (!screen) notFound()

  const initialData = await getInitialSessionData(screenId)

  return <ScreenDisplay screenId={screenId} initialData={initialData} />
}
