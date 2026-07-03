'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // The Supabase browser client automatically exchanges hash fragment tokens
    // (access_token, refresh_token) into a real session via detectSessionInUrl
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }

      const role = session.user.app_metadata?.role

      if (role === 'client') {
        // New clients coming from invite email need to set their password
        router.replace('/client/set-password')
      } else if (role === 'employee') {
        router.replace('/dashboard')
      } else {
        router.replace('/login')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
      <p className="text-[#666666] text-sm">Verificando acceso...</p>
    </div>
  )
}
