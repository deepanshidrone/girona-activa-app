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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'employee') return { error: 'No autorizado' }

  // 1. Crear usuario en Supabase Auth con rol 'client' en metadata
  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email: data.email,
    password: crypto.randomUUID(), // contraseña temporal aleatoria
    email_confirm: true,
    user_metadata: { role: 'client' },
  })

  if (authError) {
    // Si el email ya existe, intentamos obtener el usuario existente
    if (!authError.message.includes('already')) {
      return { error: 'Error al crear el acceso: ' + authError.message }
    }
  }

  // 2. Insertar en la tabla clients
  const { error: clientError } = await adminSupabase.from('clients').insert({
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

  // 3. Enviar email para que el cliente establezca su contraseña
  if (authData?.user) {
    await adminSupabase.auth.admin.generateLink({
      type: 'recovery',
      email: data.email,
    })
  }

  return { success: true }
}
