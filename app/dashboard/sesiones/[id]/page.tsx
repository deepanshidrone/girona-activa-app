import { notFound } from 'next/navigation'
import { getGroupCycleByIdAction } from '@/app/actions/group-sessions'
import { createAdminClient } from '@/lib/supabase/admin'
import CycleEditor from './cycle-editor'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const [{ cycle, error }, exercisesResult, employeesResult, clientsResult] = await Promise.all([
    getGroupCycleByIdAction(id),
    supabase.from('exercises').select('id, name, technical_name').order('name'),
    supabase.from('profiles').select('id, full_name').eq('role', 'employee').order('full_name'),
    supabase.from('clients').select('id, first_name, last_name').eq('is_active', true).order('first_name'),
  ])

  if (error || !cycle) notFound()

  return (
    <CycleEditor
      cycle={cycle as any}
      exercises={exercisesResult.data ?? [] as any}
      employees={employeesResult.data ?? []}
      clients={clientsResult.data ?? []}
    />
  )
}
