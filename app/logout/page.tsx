'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.signOut().then(() => {
      router.push('/login')
      router.refresh()
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <p className="text-[#666666]">Cerrando sesión...</p>
    </div>
  )
}
