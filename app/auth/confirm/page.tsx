'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data: { session }, error }) => {
          if (error || !session) { router.replace('/login'); return }
          const role = session.user.app_metadata?.role
          router.replace(role === 'client' ? '/client/set-password' : '/dashboard')
        })
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) { router.replace('/login'); return }
        const role = session.user.app_metadata?.role
        router.replace(role === 'client' ? '/client' : '/dashboard')
      })
    }
  }, [router])

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
      <p className="text-[#666666] text-sm">Verificando acceso...</p>
    </div>
  )
}
