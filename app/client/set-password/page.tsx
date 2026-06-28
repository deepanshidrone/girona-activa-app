'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function SetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('Error al actualizar la contraseña: ' + error.message)
      setLoading(false)
      return
    }

    router.push('/client')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full overflow-hidden mb-4 shadow">
            <Image src="/logo.png" alt="Girona Activa" width={64} height={64} className="object-cover w-full h-full" />
          </div>
          <h1 className="text-xl font-semibold tracking-widest uppercase italic text-[#1C1C1C]">
            GIRONA ACTIVA
          </h1>
        </div>

        <div className="bg-white rounded-2xl border border-[#E5E5E5] p-6">
          <h2 className="text-xl font-bold text-[#1C1C1C] mb-1">Bienvenido/a 👋</h2>
          <p className="text-[#666666] text-sm mb-6">
            Establece tu contraseña para acceder a tu área de entrenamiento.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1C1C1C]">Nueva contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                className="border border-[#E5E5E5] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#FF914D] transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#1C1C1C]">Confirmar contraseña</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repite la contraseña"
                required
                className="border border-[#E5E5E5] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#FF914D] transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-[#FF914D] text-white font-semibold py-3 rounded-lg hover:bg-[#e07a3a] transition-colors disabled:opacity-60 mt-2"
            >
              {loading ? 'Guardando...' : 'Acceder a mi área'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
