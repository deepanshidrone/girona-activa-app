import { getSessionDetailAction } from '@/app/actions/session-logs'
import { notFound } from 'next/navigation'
import { SessionRunner } from './session-runner'

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  const { session, error } = await getSessionDetailAction(sessionId)

  if (error || !session) notFound()

  const plan = (session as any).training_plans
  const client = plan?.clients
  const exercises = ((session as any).plan_session_exercises ?? [])
    .sort((a: any, b: any) => a.order_index - b.order_index)
  const existingLog = (session as any).session_logs?.[0] ?? null

  return (
    <SessionRunner
      planSessionId={session.id}
      sessionDate={(session as any).session_date}
      sessionTime={(session as any).session_time}
      client={client}
      planLevel={plan?.level}
      planType={plan?.type}
      exercises={exercises}
      existingLog={existingLog}
    />
  )
}
