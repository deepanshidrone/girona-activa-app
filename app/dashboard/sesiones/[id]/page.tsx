import { notFound } from 'next/navigation'
import { getGroupCycleByIdAction } from '@/app/actions/group-sessions'
import { createAdminClient } from '@/lib/supabase/admin'
import CycleEditor from './cycle-editor'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [{ cycle, error }, exercisesResult] = await Promise.all([
    getGroupCycleByIdAction(id),
    createAdminClient()
      .from('exercises')
      .select('id, name, technical_name')
      .order('name'),
  ])

  if (error || !cycle) notFound()

  const exercises = exercisesResult.data ?? []

  return <CycleEditor cycle={cycle as any} exercises={exercises as any} />
}
