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

async function sendInviteEmail(email: string, firstName: string, inviteLink: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 18px; font-weight: bold; letter-spacing: 4px; text-transform: uppercase; font-style: italic; color: #1C1C1C; margin: 0;">
          GIRONA ACTIVA
        </h1>
      </div>

      <h2 style="font-size: 22px; font-weight: bold; color: #1C1C1C; margin-bottom: 8px;">
        Bienvenido/a, ${firstName} 👋
      </h2>
      <p style="color: #666666; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
        Tu entrenador ha creado tu área personal en Girona Activa. Desde aquí podrás consultar tu plan de entrenamiento en cualquier momento.
      </p>

      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${inviteLink}" style="background: #FF914D; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 14px 32px; border-radius: 10px; display: inline-block;">
          Activar mi cuenta
        </a>
      </div>

      <p style="color: #999999; font-size: 13px; text-align: center;">
        Este enlace es válido durante 24 horas.<br/>
        Si no esperabas este email, puedes ignorarlo.
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
      subject: '¡Bienvenido/a a Girona Activa! Activa tu cuenta',
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error('Error Resend: ' + err)
  }
}

export async function createClientAction(data: CreateClientData) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado — sesión no encontrada' }
  const user = session.user

  const role = user.app_metadata?.role
  if (role !== 'employee') return { error: 'No autorizado — rol incorrecto: ' + (role ?? 'sin rol') }

  // 1. Generar link de invitación sin enviar email (evita el rate limit de Supabase)
  const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
    type: 'invite',
    email: data.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
      data: { role: 'client' },
    },
  })

  if (linkError) {
    return { error: 'Error al generar la invitación: ' + (linkError.message || linkError.code || JSON.stringify(linkError)) }
  }

  const authUser = linkData.user

  // 2. Establecer app_metadata con el rol
  await adminSupabase.auth.admin.updateUserById(authUser.id, {
    app_metadata: { role: 'client' },
  })

  // 3. Enviar email con Resend directamente
  try {
    await sendInviteEmail(data.email, data.first_name, linkData.properties.action_link)
  } catch (e: any) {
    return { error: 'Error al enviar el email: ' + e.message }
  }

  // 4. Insertar cliente en la BD
  const { error: clientError } = await supabase.from('clients').insert({
    user_id: authUser.id,
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
