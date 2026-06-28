'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type CreateClientData = {
  first_name: string
  last_name: string
  sex: string
  birth_date: string
  height_cm: number
  weight_kg: number
  start_date: string
  email: string
  notes?: string
}

export async function createClientAction(data: CreateClientData) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()

  // Verificar que quien llama es un empleado
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado — sesión no encontrada' }
  const user = session.user

  const role = user.app_metadata?.role
  if (role !== 'employee') return { error: 'No autorizado — rol incorrecto: ' + (role ?? 'sin rol') }

  // 1. Invitar al cliente — crea el usuario Y envía el email de bienvenida automáticamente
  const { data: authData, error: authError } = await adminSupabase.auth.admin.inviteUserByEmail(
    data.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/client/set-password`,
      data: { role: 'client' },
    }
  )

  if (authError) {
    return { error: 'Error al enviar la invitación: ' + authError.message }
  }

  // 2. Establecer app_metadata con el rol (inviteUserByEmail solo set user_metadata)
  if (authData?.user) {
    await adminSupabase.auth.admin.updateUserById(authData.user.id, {
      app_metadata: { role: 'client' },
    })
  }

  // 3. Insertar cliente en la BD
  const { error: clientError } = await supabase.from('clients').insert({
    user_id: authData?.user?.id ?? null,
    first_name: data.first_name,
    last_name: data.last_name,
    sex: data.sex,
    birth_date: data.birth_date,
    height_cm: data.height_cm,
    weight_kg: data.weight_kg,
    start_date: data.start_date,
    notes: data.notes || null,
    created_by: user.id,
  })

  if (clientError) {
    return { error: 'Error al guardar el cliente: ' + clientError.message }
  }

  return { success: true }
}
