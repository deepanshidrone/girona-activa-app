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
  // Some users may have app_metadata.role = 'client' even if profiles.role = 'employee',
  // so we cross-reference with profiles table as the source of truth.
  const allIds = authUsers.users.map(u => u.id)
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, role')
    .in('id', allIds)
    .in('role', ['employee', 'admin'])

  const employeeProfileIds = new Set((allProfiles ?? []).map(p => p.id))

  const employeeUsers = authUsers.users.filter(u => {
    const metaRole = u.app_metadata?.role
    return metaRole === 'employee' || metaRole === 'admin' || employeeProfileIds.has(u.id)
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

async function sendEmployeeInviteEmail(email: string, fullName: string, inviteLink: string, role: string) {
  const firstName = fullName.split(' ')[0]
  const roleLabel = role === 'admin' ? 'administrador/a' : 'entrenador/a'

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 18px; font-weight: bold; letter-spacing: 4px; text-transform: uppercase; font-style: italic; color: #1C1C1C; margin: 0;">
          GIRONA ACTIVA
        </h1>
      </div>

      <h2 style="font-size: 22px; font-weight: bold; color: #1C1C1C; margin-bottom: 8px;">
        Benvingut/da, ${firstName}! 👋
      </h2>
      <p style="color: #666666; font-size: 15px; line-height: 1.6; margin-bottom: 8px;">
        S'ha creat el teu compte com a <strong>${roleLabel}</strong> a Girona Activa.
      </p>
      <p style="color: #666666; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
        Des del teu panell podràs gestionar sessions, clients i plans d'entrenament. Fes clic al botó per establir la teva contrasenya i activar el compte.
      </p>

      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${inviteLink}" style="background: #FF914D; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 14px 32px; border-radius: 10px; display: inline-block;">
          Activar el meu compte
        </a>
      </div>

      <p style="color: #999999; font-size: 13px; text-align: center;">
        Aquest enllaç és vàlid durant 24 hores.<br/>
        Si no esperaves aquest email, pots ignorar-lo.
      </p>
    </div>
  `

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Girona Activa <noreply@gironaactiva.com>',
      to: email,
      subject: 'Benvingut/da a Girona Activa! Activa el teu compte',
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error('Error Resend: ' + err)
  }
}

export async function createEmployeeAction(data: CreateEmployeeData): Promise<{ error?: string; id?: string }> {
  const supabase = createAdminClient()

  // Generate invite link (same flow as clients — no Supabase default email)
  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: 'invite',
    email: data.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
      data: { role: data.role },
    },
  })

  if (linkError) {
    if (linkError.message?.includes('already been registered') || linkError.message?.includes('already exists')) {
      return { error: 'Ja existeix un usuari amb aquest email.' }
    }
    return { error: linkError.message }
  }

  const userId = linkData.user.id

  // Set app_metadata role
  await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role: data.role },
  })

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

  // Send branded email via Resend
  try {
    await sendEmployeeInviteEmail(data.email, data.full_name, linkData.properties.action_link, data.role)
  } catch (e: any) {
    return { error: 'Error al enviar el email: ' + e.message }
  }

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
