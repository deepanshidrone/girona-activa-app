'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthConfirmPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Supabase JS automatically picks up hash fragment tokens
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      const role = session.user.app_metadata?.role
      if (role === 'client') {
        router.replace('/client/set-password')
      } else {
        router.replace('/dashboard')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
      <p className="text-[#666666] text-sm">Verificando tu acceso...</p>
    </div>
  )
}
