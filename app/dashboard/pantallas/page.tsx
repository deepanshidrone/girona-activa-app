import { createAdminClient } from '@/lib/supabase/admin'
import { headers } from 'next/headers'
import PantallasClient from './pantallas-client'

export const dynamic = 'force-dynamic'

export default async function PantallasPage() {
  const adminSupabase = createAdminClient()

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: screensData },
    { data: clientsData },
    { data: activeAssignments },
    { data: planSessionsData },
  ] = await Promise.all([
    adminSupabase.from('screens').select('*').order('name'),
    adminSupabase.from('profiles').select('id, full_name').eq('role', 'client').order('full_name'),
    adminSupabase
      .from('screen_assignments')
      .select('id, screen_id, session_type, client_id, plan_session_id, assigned_by, started_at')
      .is('ended_at', null),
    // Today's sessions joined with their plan to get client_id
    adminSupabase
      .from('plan_sessions')
      .select('id, session_date, plan_id, training_plans!inner(client_id)')
      .eq('session_date', today),
  ])

  const profileMap = new Map((clientsData ?? []).map((p: any) => [p.id, p.full_name]))
  const assignmentByScreen = new Map((activeAssignments ?? []).map((a: any) => [a.screen_id, a]))

  const screens = (screensData ?? []).map((screen: any) => {
    const a = assignmentByScreen.get(screen.id)
    const sessionDate = a?.plan_session_id
      ? (planSessionsData ?? []).find((s: any) => s.id === a.plan_session_id)?.session_date ?? null
      : null

    return {
      id: screen.id,
      name: screen.name,
      location: screen.location,
      access_token: screen.access_token,
      activeAssignment: a
        ? {
            id: a.id,
            session_type: a.session_type,
            client_name: a.client_id ? profileMap.get(a.client_id) ?? null : null,
            session_date: sessionDate,
          }
        : null,
    }
  })

  const clients = (clientsData ?? []).map((c: any) => ({ id: c.id, full_name: c.full_name }))

  // Group today's sessions by client_id (via training_plans join)
  const todaySessions = clients.map((client: any) => {
    const sessions = (planSessionsData ?? [])
      .filter((s: any) => {
        const plan: any = Array.isArray(s.training_plans) ? s.training_plans[0] : s.training_plans
        return plan?.client_id === client.id
      })
      .map((s: any) => ({
        id: s.id,
        session_date: s.session_date,
        plan_name: 'Sessió',
      }))
    return { clientId: client.id, sessions }
  })

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${proto}://${host}`

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-white text-2xl font-bold mb-1">Pantallas</h1>
        <p className="text-white/40 text-sm">Gestiona les pantalles del centre i fes check-in de sessions.</p>
      </div>

      <PantallasClient
        screens={screens}
        clients={clients}
        todaySessions={todaySessions}
        baseUrl={baseUrl}
      />
    </div>
  )
}
