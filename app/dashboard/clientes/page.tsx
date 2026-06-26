import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'

export default function ClientesPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]">Clientes</h1>
          <p className="text-[#666666] text-sm mt-1">Gestiona los clientes del centro</p>
        </div>
        <Link href="/dashboard/clientes/nuevo">
          <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
            <UserPlus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        </Link>
      </div>

      {/* Lista vacía por ahora */}
      <div className="bg-white rounded-2xl border border-[#E5E5E5] p-12 flex flex-col items-center justify-center text-center">
        <div className="w-12 h-12 rounded-full bg-[#FF914D]/10 flex items-center justify-center mb-4">
          <UserPlus className="h-6 w-6 text-[#FF914D]" />
        </div>
        <h3 className="text-[#1C1C1C] font-semibold mb-1">No hay clientes todavía</h3>
        <p className="text-[#666666] text-sm mb-4">Empieza dando de alta a tu primer cliente</p>
        <Link href="/dashboard/clientes/nuevo">
          <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
            <UserPlus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        </Link>
      </div>
    </div>
  )
}
