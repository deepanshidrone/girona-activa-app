'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F5F5F5] px-4">
      <div className="w-full max-w-md">

        {/* Logo + nombre */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full overflow-hidden mb-4 shadow">
            <Image
              src="/logo.png"
              alt="Girona Activa"
              width={64}
              height={64}
              className="object-cover w-full h-full"
            />
          </div>
          <h1
            className="text-2xl font-semibold tracking-widest uppercase"
            style={{ fontStyle: 'italic', transform: 'skewX(-12deg)', color: '#1C1C1C' }}
          >
            GIRONA ACTIVA
          </h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#E5E5E5] p-8">
          <h2 className="text-xl font-bold text-[#1C1C1C] mb-1">Accede a tu cuenta</h2>
          <p className="text-[#666666] text-sm mb-6">Introduce tu email y contraseña</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-[#1C1C1C]">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                className="border border-[#E5E5E5] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#FF914D] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium text-[#1C1C1C]">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="border border-[#E5E5E5] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#FF914D] transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm bg-red-50 px-4 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-[#FF914D] text-white font-semibold py-3 rounded-lg hover:bg-[#e07a3a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>

      </div>
    </main>
  )
}
