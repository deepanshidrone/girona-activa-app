'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type Employee = {
  id: string
  email: string
  full_name: string
  role: 'employee' | 'admin'
  phone: string | null
  hire_date: string | null
  specialties: string[]
  is_active: boolean
  avatar_url: string | null
  last_sign_in: string | null
}

export type CreateEmployeeData = {
  full_name: string
  email: string
  role: 'employee' | 'admin'
  phone?: string
  hire_date?: string
  specialties?: string[]
}

export type UpdateEmployeeData = {
  full_name?: string
  phone?: string
  hire_date?: string
  specialties?: string[]
  role?: 'employee' | 'admin'
}

export async function getEmployeesAction(): Promise<Employee[]> {
  const supabase = createAdminClient()

  const { data: authUsers, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (error) return []

  // Filter to only employees and admins (not clients)
  const employeeUsers = authUsers.users.filter(u => {
    const role = u.app_metadata?.role
    return role === 'employee' || role === 'admin'
  })

  if (employeeUsers.length === 0) return []

  const ids = employeeUsers.map(u => u.id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, phone, hire_date, specialties, is_active')
    .in('id', ids)

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

  return employeeUsers.map(u => {
    const profile = profileMap.get(u.id)
    return {
      id: u.id,
      email: u.email ?? '',
      full_name: profile?.full_name ?? u.email?.split('@')[0] ?? '',
      role: (u.app_metadata?.role ?? 'employee') as 'employee' | 'admin',
      phone: profile?.phone ?? null,
      hire_date: profile?.hire_date ?? null,
      specialties: profile?.specialties ?? [],
      is_active: profile?.is_active ?? true,
      avatar_url: profile?.avatar_url ?? null,
      last_sign_in: u.last_sign_in_at ?? null,
    }
  }).sort((a, b) => a.full_name.localeCompare(b.full_name))
}

export async function getEmployeeByIdAction(id: string): Promise<Employee | null> {
  const supabase = createAdminClient()

  const { data: authUser, error } = await supabase.auth.admin.getUserById(id)
  if (error || !authUser.user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, phone, hire_date, specialties, is_active')
    .eq('id', id)
    .single()

  const u = authUser.user
  return {
    id: u.id,
    email: u.email ?? '',
    full_name: profile?.full_name ?? u.email?.split('@')[0] ?? '',
    role: (u.app_metadata?.role ?? 'employee') as 'employee' | 'admin',
    phone: profile?.phone ?? null,
    hire_date: profile?.hire_date ?? null,
    specialties: profile?.specialties ?? [],
    is_active: profile?.is_active ?? true,
    avatar_url: profile?.avatar_url ?? null,
    last_sign_in: u.last_sign_in_at ?? null,
  }
}

export async function createEmployeeAction(data: CreateEmployeeData): Promise<{ error?: string; id?: string }> {
  const supabase = createAdminClient()

  // Create auth user and send invite email
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: data.email,
    email_confirm: false,
    app_metadata: { role: data.role },
    user_metadata: { full_name: data.full_name },
  })

  if (createError) {
    if (createError.message.includes('already been registered') || createError.message.includes('already exists')) {
      return { error: 'Ya existe un usuario con este email.' }
    }
    return { error: createError.message }
  }

  const userId = created.user.id

  // Create profile
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: data.full_name,
    role: data.role,
    phone: data.phone || null,
    hire_date: data.hire_date || null,
    specialties: data.specialties ?? [],
    is_active: true,
    updated_at: new Date().toISOString(),
  })

  if (profileError) return { error: profileError.message }

  // Send invite link via Supabase
  await supabase.auth.admin.inviteUserByEmail(data.email)

  revalidatePath('/dashboard/empleados')
  return { id: userId }
}

export async function updateEmployeeAction(id: string, data: UpdateEmployeeData): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  // Update app_metadata role if role changed
  if (data.role) {
    const { error } = await supabase.auth.admin.updateUserById(id, {
      app_metadata: { role: data.role },
    })
    if (error) return { error: error.message }
  }

  // Update profile
  const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (data.full_name !== undefined) profileUpdates.full_name = data.full_name
  if (data.phone !== undefined) profileUpdates.phone = data.phone || null
  if (data.hire_date !== undefined) profileUpdates.hire_date = data.hire_date || null
  if (data.specialties !== undefined) profileUpdates.specialties = data.specialties
  if (data.role !== undefined) profileUpdates.role = data.role

  const { error } = await supabase.from('profiles').update(profileUpdates).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/dashboard/empleados')
  revalidatePath(`/dashboard/empleados/${id}`)
  return {}
}

export async function toggleEmployeeActiveAction(id: string, is_active: boolean): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('profiles')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/empleados')
  revalidatePath(`/dashboard/empleados/${id}`)
  return {}
}

export async function changeEmployeePasswordAction(id: string, newPassword: string): Promise<{ error?: string }> {
  if (newPassword.length < 8) return { error: 'La contrasenya ha de tenir mínim 8 caràcters.' }

  const supabase = createAdminClient()
  const { error } = await supabase.auth.admin.updateUserById(id, { password: newPassword })
  if (error) return { error: error.message }

  return {}
}

export async function getEmployeeSessionsAction(id: string) {
  const supabase = createAdminClient()

  const { data: slots } = await supabase
    .from('group_cycle_slots')
    .select(`
      id, day_index, session_time, block_label, max_clients,
      group_cycle_slot_clients (client_id),
      group_cycles!inner (id, start_date)
    `)
    .eq('assigned_employee_id', id)
    .order('day_index')

  return slots ?? []
}
