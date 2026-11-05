'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/auth/permissions'

export type CreateClientData = {
  first_name: string
  last_name: string
  sex: string
  birth_date: string
  height_cm: number
  weight_kg: number
  start_date: string
  email?: string   // opcional: sin email el cliente no puede recibir acceso a la app
  notes?: string
}

function normalizeEmail(email?: string | null): string | null {
  const value = email?.trim().toLowerCase()
  return value ? value : null
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
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

// Alta de cliente: crea solo la ficha. El acceso a la app es un paso aparte
// (inviteClientAction), opcional: muchos socios no usarán la app.
export async function createClientAction(data: CreateClientData) {
  const auth = await requireStaff()
  if (!auth.user) return { error: auth.error }
  const user = auth.user

  const email = normalizeEmail(data.email)
  if (email && !isValidEmail(email)) return { error: 'El email no es válido' }

  const adminSupabase = createAdminClient()
  const { data: client, error: clientError } = await adminSupabase.from('clients').insert({
    email,
    first_name: data.first_name,
    last_name: data.last_name,
    sex: data.sex,
    birth_date: data.birth_date,
    height_cm: data.height_cm,
    weight_kg: data.weight_kg,
    start_date: data.start_date,
    notes: data.notes || null,
    created_by: user.id,
  }).select('id').single()

  if (clientError) {
    return { error: 'Error al guardar el cliente: ' + clientError.message }
  }

  return { success: true, id: client.id }
}

// Invita al cliente a la app, o le reenvía la invitación si aún no ha entrado.
// - Sin cuenta: crea la cuenta (rol client), la enlaza a la ficha y envía el correo.
// - Con cuenta sin estrenar: genera un enlace nuevo (el anterior caduca a las 24 h).
// Si se pasa `email` y la ficha no tiene, se guarda antes de invitar.
export async function inviteClientAction(clientId: string, email?: string) {
  const auth = await requireStaff()
  if (!auth.user) return { error: auth.error }
  const adminSupabase = createAdminClient()

  const { data: client, error: clientError } = await adminSupabase
    .from('clients')
    .select('id, first_name, email, user_id')
    .eq('id', clientId)
    .single()
  if (clientError || !client) return { error: 'Cliente no encontrado' }

  let targetEmail = normalizeEmail(client.email)
  const newEmail = normalizeEmail(email)
  if (!targetEmail && newEmail) {
    if (!isValidEmail(newEmail)) return { error: 'El email no es válido' }
    const { error } = await adminSupabase.from('clients').update({ email: newEmail }).eq('id', clientId)
    if (error) return { error: 'Error al guardar el email: ' + error.message }
    targetEmail = newEmail
  }
  if (!targetEmail) return { error: 'Añade un email al cliente para poder invitarle' }

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`
  let actionLink: string

  if (!client.user_id) {
    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'invite',
      email: targetEmail,
      options: { redirectTo, data: { role: 'client', full_name: client.first_name } },
    })
    if (linkError) {
      console.error('generateLink invite error:', linkError)
      if (/already been registered|already exists/i.test(linkError.message ?? '')) {
        return { error: 'Ya existe una cuenta con este email. Usa otro email o revisa si pertenece a otra persona.' }
      }
      return { error: 'Error al generar la invitación: ' + (linkError.message || 'sin mensaje') }
    }

    // Si el email ya tenía una cuenta invitada sin estrenar, Supabase devuelve esa
    // misma cuenta sin error. No reutilizarla si es de personal o de otro cliente.
    const existingRole = linkData.user.app_metadata?.role
    if (existingRole && existingRole !== 'client') {
      return { error: 'Este email pertenece a una cuenta de personal del centro. Usa otro email.' }
    }
    const { data: linkedClient } = await adminSupabase
      .from('clients')
      .select('id')
      .eq('user_id', linkData.user.id)
      .neq('id', clientId)
      .maybeSingle()
    if (linkedClient) {
      return { error: 'Este email ya está asociado a otro cliente. Usa otro email.' }
    }

    // El rol se fija en app_metadata (fuente de verdad); un trigger lo copia a profiles.
    const { error: roleError } = await adminSupabase.auth.admin.updateUserById(linkData.user.id, {
      app_metadata: { role: 'client' },
    })
    if (roleError) return { error: 'Error al asignar el rol: ' + roleError.message }

    const { error: linkClientError } = await adminSupabase
      .from('clients')
      .update({ user_id: linkData.user.id })
      .eq('id', clientId)
    if (linkClientError) return { error: 'Error al enlazar la cuenta: ' + linkClientError.message }

    actionLink = linkData.properties.action_link
  } else {
    const { data: existing } = await adminSupabase.auth.admin.getUserById(client.user_id)
    if (existing?.user?.last_sign_in_at) {
      return { error: 'Este cliente ya tiene acceso activo a la app' }
    }

    const { data: linkData, error: linkError } = await adminSupabase.auth.admin.generateLink({
      type: 'recovery',
      email: existing?.user?.email ?? targetEmail,
      options: { redirectTo },
    })
    if (linkError) {
      console.error('generateLink recovery error:', linkError)
      return { error: 'Error al generar la invitación: ' + (linkError.message || 'sin mensaje') }
    }
    actionLink = linkData.properties.action_link
  }

  try {
    await sendInviteEmail(targetEmail, client.first_name, actionLink)
  } catch (e: any) {
    return { error: 'Error al enviar el email: ' + e.message }
  }

  return { success: true }
}
