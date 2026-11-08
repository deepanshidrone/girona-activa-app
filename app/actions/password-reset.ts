'use server'

import { after } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { BRAND } from '@/lib/brand'

// "Olvidé mi contraseña" (pantalla /auth/recuperar).
//
// ACCIÓN PÚBLICA A PROPÓSITO: la usa quien no puede iniciar sesión, así que no
// llama a requireStaff()/requireClient(). Para que no se pueda abusar de ella:
// - La respuesta es SIEMPRE la misma, exista o no la cuenta, y el correo se
//   envía después de responder (after), para no delatar por el tiempo quién
//   tiene cuenta.
// - Límite por IP (10/hora): si se supera, se avisa de que espere.
// - Límite por email (1 cada 2 min, 5/día): se aplica en silencio.
// - Solo genera un enlace de recuperación de Supabase hacia /auth/confirm, el
//   mismo flujo que la invitación (→ /auth/set-password).
// Tabla de control: password_reset_requests (solo service_role).

const PER_IP_PER_HOUR = 10
const EMAIL_MIN_INTERVAL_MS = 2 * 60 * 1000
const EMAIL_PER_DAY = 5

export type PasswordResetResult = { ok: true } | { ok: false; error: string }

export async function requestPasswordResetAction(rawEmail: string): Promise<PasswordResetResult> {
  const email = (rawEmail ?? '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: false, error: 'Escribe un email válido.' }
  }

  const h = await headers()
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim() || null

  const admin = createAdminClient()
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  if (ip) {
    const { count } = await admin
      .from('password_reset_requests')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', hourAgo)
    if ((count ?? 0) >= PER_IP_PER_HOUR) {
      return { ok: false, error: 'Has hecho demasiadas solicitudes. Inténtalo dentro de un rato.' }
    }
  }

  // Comprobar el límite por email ANTES de anotar esta solicitud
  const { data: previas } = await admin
    .from('password_reset_requests')
    .select('created_at')
    .eq('email', email)
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
  const ultima = previas?.[0]?.created_at ? new Date(previas[0].created_at).getTime() : 0
  const puedeEnviar = (previas?.length ?? 0) < EMAIL_PER_DAY && Date.now() - ultima >= EMAIL_MIN_INTERVAL_MS

  await admin.from('password_reset_requests').insert({ email, ip })

  after(async () => {
    const admin = createAdminClient()
    // Limpieza de solicitudes antiguas
    await admin.from('password_reset_requests').delete()
      .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    if (!puedeEnviar) return

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm` },
    })
    // Sin cuenta con ese email: no se envía nada (y no se dice)
    if (error || !data?.properties?.action_link) return

    const nombre = (data.user.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    try {
      await sendResetEmail(email, data.properties.action_link, nombre)
    } catch (e) {
      console.error('Error enviando el correo de recuperación:', e)
    }
  })

  return { ok: true }
}

async function sendResetEmail(email: string, link: string, nombre?: string) {
  const saludo = nombre ? `Hola, ${escapeHtml(nombre)}` : 'Hola'
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 18px; font-weight: bold; letter-spacing: 4px; text-transform: uppercase; font-style: italic; color: #1C1C1C; margin: 0;">
          ${BRAND.shortName}
        </h1>
      </div>
      <h2 style="font-size: 22px; font-weight: bold; color: #1C1C1C; margin-bottom: 8px;">${saludo}</h2>
      <p style="color: #666666; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
        Hemos recibido una solicitud para cambiar la contraseña de tu cuenta en ${BRAND.name}.
        Pulsa el botón para elegir una contraseña nueva.
      </p>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${link}" style="background: ${BRAND.primary}; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 15px; padding: 14px 32px; border-radius: 10px; display: inline-block;">
          Cambiar mi contraseña
        </a>
      </div>
      <p style="color: #999999; font-size: 13px; text-align: center;">
        Este enlace caduca pronto y solo se puede usar una vez.<br/>
        Si no has sido tú, ignora este correo: tu contraseña no cambiará.
      </p>
    </div>
  `
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: BRAND.emailFrom,
      to: email,
      subject: `Cambia tu contraseña de ${BRAND.name}`,
      html,
    }),
  })
  if (!res.ok) throw new Error('Resend: ' + (await res.text()))
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}
