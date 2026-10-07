'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutGrid, FileStack } from 'lucide-react'

export function SesionesTabs() {
  const pathname = usePathname()
  const isCiclos     = pathname === '/dashboard/sesiones' || pathname.startsWith('/dashboard/sesiones/nuevo') || pathname.startsWith('/dashboard/sesiones/') && !pathname.includes('plantillas')
  const isPlantillas = pathname.startsWith('/dashboard/sesiones/plantillas')

  return (
    <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 w-fit mb-6">
      <Link href="/dashboard/sesiones"
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isCiclos && !isPlantillas ? 'bg-[#1C1C1C] text-white shadow' : 'text-white/40 hover:text-white/70'}`}>
        <LayoutGrid className="h-4 w-4" />
        Ciclos
      </Link>
      <Link href="/dashboard/sesiones/plantillas"
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isPlantillas ? 'bg-[#1C1C1C] text-white shadow' : 'text-white/40 hover:text-white/70'}`}>
        <FileStack className="h-4 w-4" />
        Plantillas
      </Link>
    </div>
  )
}
