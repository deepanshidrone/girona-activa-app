import { notFound } from 'next/navigation'
import { getGroupSessionForLogAction } from '@/app/actions/group-session-logs'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCenterToday } from '@/lib/center-settings'
import { GroupSessionRunner } from './group-runner'

export const dynamic = 'force-dynamic'

// Registro de una sesión grupal: pasar lista (obligatorio) y detalle por
// asistente (opcional). docs/spec-vista-cliente.md §7.3
export default async function GroupSessionLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getGroupSessionForLogAction(id)
  if (!session) notFound()
  const today = await getCenterToday(createAdminClient())

  return <GroupSessionRunner session={session} isFuture={session.session_date > today} />
}
