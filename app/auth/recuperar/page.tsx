'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { requestPasswordResetAction } from '@/app/actions/password-reset'
import { BRAND } from '@/lib/brand'

// "Olvidé mi contraseña": pide el email y envía un enlace para elegir una
// contraseña nueva (→ /auth/confirm → /auth/set-password). La respuesta es la
// misma exista o no la cuenta.
export default function RecoverPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await requestPasswordResetAction(email)
    setLoading(false)
    if (!result.ok) return setError(result.error)
    setSent(true)
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center bg-[#111111] px-4"
      style={{ '--brand': BRAND.primary } as React.CSSProperties}
    >
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/10">
            <Image src={BRAND.logoUrl} alt={BRAND.name} width={80} height={80} className="object-cover w-full h-full" />
          </div>
        </div>

        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-8">
          {sent ? (
            <div className="text-center">
              <MailCheck className="h-10 w-10 text-[var(--brand)] mx-auto mb-4" />
              <h1 className="text-xl font-bold text-white mb-2">Revisa tu correo</h1>
              <p className="text-white/60 text-sm leading-relaxed">
                Si <span className="text-white">{email}</span> tiene una cuenta, te hemos enviado un enlace para elegir una
                contraseña nueva. Puede tardar unos minutos; mira también en la carpeta de spam.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white mb-1">¿Has olvidado tu contraseña?</h1>
              <p className="text-white/50 text-sm mb-6">
                Escribe tu email y te enviaremos un enlace para elegir una contraseña nueva.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-white/70">Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="tu@email.com"
                    className="bg-[#111111] border border-white/10 rounded-lg px-4 py-3 text-base text-white placeholder-white/30 outline-none focus:border-[var(--brand)] transition-colors"
                  />
                </div>
                {error && (
                  <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 bg-[var(--brand)] text-white font-bold py-3 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {loading ? 'Enviando…' : 'Enviar enlace'}
                </button>
              </form>
            </>
          )}
        </div>

        <Link href="/login" className="flex items-center justify-center gap-1.5 text-sm text-white/50 hover:text-white mt-6 py-2">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio de sesión
        </Link>
      </div>
    </main>
  )
}
