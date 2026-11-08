'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// Cambio de contraseña del cliente. Pide la actual (se comprueba volviendo a
// iniciar sesión) para que nadie con el móvil desbloqueado pueda cambiarla.
// Mismo mínimo que /auth/set-password: 8 caracteres.
export function PasswordForm({ email }: { email: string }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (next.length < 8) return setError('La contraseña nueva debe tener al menos 8 caracteres.')
    if (next !== confirm) return setError('Las contraseñas nuevas no coinciden.')
    if (next === current) return setError('La contraseña nueva debe ser distinta de la actual.')

    setLoading(true)
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: current })
    if (signInError) {
      setLoading(false)
      return setError('La contraseña actual no es correcta.')
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: next })
    setLoading(false)
    if (updateError) return setError('No se ha podido cambiar la contraseña. Inténtalo de nuevo.')

    setDone(true)
    setOpen(false)
    setCurrent(''); setNext(''); setConfirm('')
  }

  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => { setOpen(true); setDone(false) }}
          className="w-full rounded-xl border border-white/10 bg-[#1C1C1C] py-3 text-sm font-medium text-white/80 active:bg-white/5"
        >
          Cambiar contraseña
        </button>
        {done && <p className="text-xs text-green-400 text-center mt-2">Contraseña cambiada.</p>}
      </div>
    )
  }

  const input = 'w-full rounded-lg bg-white text-[#1C1C1C] px-3 h-11 text-base outline-none focus:ring-2 focus:ring-[var(--brand)]'
  return (
    <form onSubmit={handleSubmit} className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4 flex flex-col gap-3">
      <p className="font-semibold">Cambiar contraseña</p>
      <label className="flex flex-col gap-1 text-sm text-white/70">
        Contraseña actual
        <input type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-white/70">
        Contraseña nueva (mínimo 8 caracteres)
        <input type="password" autoComplete="new-password" required minLength={8} value={next} onChange={e => setNext(e.target.value)} className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-white/70">
        Repite la contraseña nueva
        <input type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={e => setConfirm(e.target.value)} className={input} />
      </label>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setOpen(false); setError('') }}
          className="flex-1 h-11 rounded-lg border border-white/10 text-sm text-white/70"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 h-11 rounded-lg bg-[var(--brand)] text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
