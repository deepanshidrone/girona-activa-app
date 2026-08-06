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
    <main className="min-h-screen flex items-center justify-center bg-[#111111] px-4">
      <div className="w-full max-w-md">

        {/* Logo + nombre */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 rounded-full overflow-hidden mb-5 shadow-lg ring-2 ring-white/10">
            <Image
              src="/logo.png"
              alt="Girona Activa"
              width={96}
              height={96}
              className="object-cover w-full h-full"
            />
          </div>
          <div className="flex gap-2 items-baseline" style={{ fontStyle: 'italic', transform: 'skewX(-8deg)' }}>
            <span className="text-3xl font-black tracking-widest uppercase text-white">GIRONA</span>
            <span className="text-3xl font-black tracking-widest uppercase text-[#FF914D]">ACTIVA</span>
          </div>
          <p className="text-white/40 text-xs tracking-widest uppercase mt-1">
            Centre d&apos;Entrenament
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-8">
          <h2 className="text-xl font-bold text-white mb-1">Accede a tu cuenta</h2>
          <p className="text-white/50 text-sm mb-6">Introduce tu email i contrasenya</p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium text-white/70">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
                className="bg-[#111111] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#FF914D] transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-medium text-white/70">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="bg-[#111111] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-[#FF914D] transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 bg-[#FF914D] text-white font-bold py-3 rounded-lg hover:bg-[#e07a3a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed tracking-wide"
            >
              {loading ? 'Entrant...' : 'Entrar'}
            </button>
          </form>
        </div>

      </div>
    </main>
  )
}
