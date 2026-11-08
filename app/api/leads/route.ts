import { createAdminClient } from '@/lib/supabase/admin'
import { verifyLeadSignature } from '@/lib/leads/signature'
import { parseLeadPayload } from '@/lib/leads/validate'

// Entrada de leads desde la web del centro (docs/spec-crm.md §5 y §6).
//
// RUTA PÚBLICA A PROPÓSITO (tercera excepción, junto con TrainWall y "Olvidé
// mi contraseña"): la llama la función de Netlify de la web, servidor a
// servidor y sin sesión, así que no usa requireStaff(). La protegen:
// - Firma HMAC con hora (LEADS_WEBHOOK_SECRET y, mientras se cambia,
//   LEADS_WEBHOOK_SECRET_PREVIOUS). Sin secreto configurado no acepta nada.
// - Cuerpo de 32 KB como máximo y validación estricta del contrato v1.
// - Idempotencia por (source, external_id): un reenvío no duplica.
// - Límite global de 60 leads nuevos por hora.
// Los logs nunca llevan datos del lead: solo el id del envío y el resultado.
// proxy.ts deja pasar esta ruta sin mirar la sesión.

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 32 * 1024
const MAX_NEW_PER_HOUR = 60

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status })

export async function POST(request: Request) {
  const secrets = [process.env.LEADS_WEBHOOK_SECRET, process.env.LEADS_WEBHOOK_SECRET_PREVIOUS]
    .filter((s): s is string => !!s && s.length >= 32)
  if (secrets.length === 0) {
    console.error('[leads] LEADS_WEBHOOK_SECRET no configurado: entrada desactivada')
    return json(503, { ok: false, error: 'No disponible' })
  }

  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) return json(413, { ok: false, error: 'Demasiado grande' })
  const body = await request.text()
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) return json(413, { ok: false, error: 'Demasiado grande' })

  const signed = verifyLeadSignature({
    secrets,
    timestamp: request.headers.get('x-brotafit-timestamp'),
    signature: request.headers.get('x-brotafit-signature'),
    body,
    nowSeconds: Math.floor(Date.now() / 1000),
  })
  if (!signed) {
    console.warn('[leads] firma no válida')
    return json(401, { ok: false, error: 'No autorizado' })
  }

  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return json(400, { ok: false, error: 'JSON no válido' })
  }

  const admin = createAdminClient()

  const { data: settings } = await admin
    .from('center_settings')
    .select('default_country_code')
    .eq('id', 1)
    .maybeSingle()
  const countryCode = settings?.default_country_code ?? '34'

  const parsed = parseLeadPayload(payload, { now: new Date(), countryCode })
  if (!parsed.ok) {
    console.warn('[leads] envío rechazado:', parsed.error)
    return json(400, { ok: false, error: parsed.error })
  }
  const { lead } = parsed

  // Reenvío de un envío que ya tenemos: no se toca ni cuenta para el límite
  const { data: existing, error: existingError } = await admin
    .from('leads')
    .select('id')
    .eq('source', lead.source)
    .eq('external_id', lead.external_id)
    .maybeSingle()
  if (existingError) return dbError('buscar duplicado', lead.external_id)
  if (existing) {
    console.info('[leads] ya existía', lead.external_id)
    return json(200, { ok: true, duplicate: true })
  }

  const { count, error: countError } = await admin
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
  if (countError) return dbError('contar', lead.external_id)
  if ((count ?? 0) >= MAX_NEW_PER_HOUR) {
    console.error('[leads] límite por hora superado; rechazado', lead.external_id)
    return json(429, { ok: false, error: 'Demasiados envíos' })
  }

  const { error: insertError } = await admin.from('leads').insert(lead)
  if (insertError) {
    // Dos envíos iguales a la vez: el segundo choca con la clave única
    if (insertError.code === '23505') return json(200, { ok: true, duplicate: true })
    return dbError('guardar', lead.external_id)
  }

  console.info('[leads] creado', lead.external_id)
  return json(201, { ok: true })
}

function dbError(step: string, externalId: string) {
  console.error(`[leads] error de BD al ${step}`, externalId)
  return json(500, { ok: false, error: 'Error interno' })
}
