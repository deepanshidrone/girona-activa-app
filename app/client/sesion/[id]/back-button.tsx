'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

// Vuelve a la pantalla anterior (Hoy, Calendario…); si se entró directo, al Calendario.
export function BackButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => (window.history.length > 1 ? router.back() : router.push('/client/calendario'))}
      aria-label="Volver"
      className="w-11 h-11 -ml-2 flex items-center justify-center rounded-full text-white/60 hover:bg-white/5 shrink-0"
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  )
}
