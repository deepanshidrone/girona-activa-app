import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ screenId: string }> }
) {
  const adminSupabase = createAdminClient()
  const { screenId } = await params

  // Get active assignment for this screen
  const { data: assignment } = await adminSupabase
    .from('screen_assignments')
    .select('*')
    .eq('screen_id', screenId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (!assignment) {
    return NextResponse.json({ sessionData: null })
  }

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
      .sort((a, b) => a.order_index - b.order_index)
      .map((pse, idx) => {
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

    return NextResponse.json({
      sessionData: {
        type: 'individual',
        clientName: client?.full_name ?? 'Cliente',
        sessionDate: planSession?.session_date ?? '',
        employeeName: assignedEmployee?.full_name ?? 'Entrenador',
        planName: plan?.name ?? 'Pla d\'entrenament',
        exercises,
      },
    })
  }

  // Group session — placeholder until group sessions are implemented
  return NextResponse.json({ sessionData: null })
}
