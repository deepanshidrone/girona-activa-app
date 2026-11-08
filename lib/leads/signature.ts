import { createHmac, timingSafeEqual } from 'node:crypto'

// Firma de los envíos de leads (docs/spec-crm.md §6.1).
//
// La web firma `<timestamp>.<cuerpo exacto>` con HMAC-SHA256 y el secreto
// compartido, y manda:
//   X-Brotafit-Timestamp: segundos Unix
//   X-Brotafit-Signature: sha256=<hex>
// Se rechazan las firmas con más de 5 minutos de desfase (no se pueden repetir
// más tarde) y se aceptan dos secretos a la vez para poder cambiarlo sin cortes.

export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60

export function signLeadPayload(secret: string, timestamp: string, body: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

export function verifyLeadSignature(opts: {
  secrets: string[]
  timestamp: string | null
  signature: string | null
  body: string
  nowSeconds: number
}): boolean {
  const { secrets, timestamp, signature, body, nowSeconds } = opts
  if (!timestamp || !signature || secrets.length === 0) return false
  if (!/^\d{1,12}$/.test(timestamp)) return false
  if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) return false
  if (!/^sha256=[0-9a-f]{64}$/.test(signature)) return false

  const received = Buffer.from(signature)
  let ok = false
  for (const secret of secrets) {
    const expected = Buffer.from(signLeadPayload(secret, timestamp, body))
    // Mismo largo garantizado por el formato; se comparan todos los secretos
    // sin cortar antes para no dar pistas por el tiempo.
    if (expected.length === received.length && timingSafeEqual(expected, received)) ok = true
  }
  return ok
}
