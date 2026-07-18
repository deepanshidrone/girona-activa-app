'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthConfirmPage() {
  const router = useRouter()
  const [debug, setDebug] = useState<string>('Iniciando...')

  useEffect(() => {
    const supabase = createClient()

    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    setDebug(`Hash: ${hash.substring(0, 80)}... | access_token: ${accessToken ? 'SÍ' : 'NO'}`)

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data: { session }, error }) => {
          if (error) {
            setDebug(`Error setSession: ${error.message}`)
            return
          }
          if (!session) {
            setDebug('setSession OK pero sin sesión')
            return
          }
          const role = session.user.app_metadata?.role
          setDebug(`Sesión OK. Role: ${role}. Redirigiendo...`)
          if (role === 'client') {
            router.replace('/client/set-password')
          } else {
            router.replace('/dashboard')
          }
        })
    } else {
      setDebug(`Sin tokens en hash. Hash completo: "${hash}"`)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setDebug(prev => prev + ' | Sin sesión existente → /login')
          router.replace('/login')
          return
        }
        const role = session.user.app_metadata?.role
        router.replace(role === 'client' ? '/client' : '/dashboard')
      })
    }
  }, [router])

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full border border-[#E5E5E5]">
        <p className="text-sm font-medium text-[#1C1C1C] mb-2">Verificando acceso...</p>
        <p className="text-xs text-[#666666] break-all font-mono">{debug}</p>
      </div>
    </div>
  )
}
