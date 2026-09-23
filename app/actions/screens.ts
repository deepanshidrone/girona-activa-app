'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type Screen = {
  id: string
  name: string
  location: string | null
  access_token: string
  created_at: string
}

export type ActiveAssignment = {
  id: string
  session_type: 'individual' | 'group'
  client_id: string | null
  plan_session_id: string | null
  group_session_id: string | null
  assigned_by: string
  started_at: string
  client_name?: string
  session_date?: string
}

export async function getScreensAction(): Promise<{ screens: Screen[]; error: string | null }> {
  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('screens')
    .select('*')
    .order('name')

  if (error) return { screens: [], error: error.message }
  return { screens: data ?? [], error: null }
}

export async function getScreensWithStatusAction(): Promise<{
  screens: (Screen & { activeAssignment: ActiveAssignment | null })[]
  error: string | null
}> {
  const adminSupabase = createAdminClient()

  const { data: screens, error } = await adminSupabase
    .from('screens')
    .select('*')
    .order('name')

  if (error) return { screens: [], error: error.message }

  const { data: assignments } = await adminSupabase
    .from('screen_assignments')
    .select('id, screen_id, session_type, client_id, plan_session_id, group_session_id, assigned_by, started_at')
    .is('ended_at', null)

  const { data: profiles } = await adminSupabase
    .from('profiles')
    .select('id, full_name')

  const { data: planSessions } = await adminSupabase
    .from('plan_sessions')
    .select('id, session_date')

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p.full_name]))
  const sessionMap = new Map((planSessions ?? []).map((s: any) => [s.id, s.session_date]))
  const assignmentByScreen = new Map((assignments ?? []).map((a: any) => [a.screen_id, a]))

  const enriched = (screens ?? []).map((screen: Screen) => {
    const a = assignmentByScreen.get(screen.id)
    if (!a) return { ...screen, activeAssignment: null }
    return {
      ...screen,
      activeAssignment: {
        ...a,
        client_name: a.client_id ? (profileMap.get(a.client_id) ?? 'Cliente') : null,
        session_date: a.plan_session_id ? sessionMap.get(a.plan_session_id) : null,
      } as ActiveAssignment,
    }
  })

  return { screens: enriched, error: null }
}

export async function createScreenAssignmentAction(params: {
  screen_id: string
  session_type: 'individual' | 'group'
  client_id?: string
  plan_session_id?: string
  group_session_id?: string
}): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const adminSupabase = createAdminClient()

  // End any existing active assignment on this screen
  await adminSupabase
    .from('screen_assignments')
    .update({ ended_at: new Date().toISOString() })
    .eq('screen_id', params.screen_id)
    .is('ended_at', null)

  const { error } = await adminSupabase
    .from('screen_assignments')
    .insert({
      screen_id: params.screen_id,
      session_type: params.session_type,
      client_id: params.client_id ?? null,
      plan_session_id: params.plan_session_id ?? null,
      group_session_id: params.group_session_id ?? null,
      assigned_by: user.id,
    })

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

export async function endScreenAssignmentAction(
  screen_id: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase
    .from('screen_assignments')
    .update({ ended_at: new Date().toISOString() })
    .eq('screen_id', screen_id)
    .is('ended_at', null)

  if (error) return { success: false, error: error.message }
  return { success: true, error: null }
}

// Used by the public screen route to validate the token and get the screen id
export async function getScreenByTokenAction(
  screenId: string,
  token: string
): Promise<{ screen: Screen | null; error: string | null }> {
  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('screens')
    .select('*')
    .eq('id', screenId)
    .eq('access_token', token)
    .single()

  if (error || !data) return { screen: null, error: 'Token inválido' }
  return { screen: data, error: null }
}
