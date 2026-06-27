import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { UserPlus, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function ClientesPage() {
  const supabase = await createClient()

  const { data: clientes } = await supabase
    .from('clients')
    .select('id, first_name, last_name, sex, birth_date, start_date, is_active, notes')
    .order('created_at', { ascending: false })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C]">Clientes</h1>
          <p className="text-[#666666] text-sm mt-1">
            {clientes?.length ?? 0} cliente{clientes?.length !== 1 ? 's' : ''} en total
          </p>
        </div>
        <Link href="/dashboard/clientes/nuevo">
          <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
            <UserPlus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        </Link>
      </div>

      {!clientes || clientes.length === 0 ? (
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
      ) : (
        <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#F5F5F5]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#666666] uppercase tracking-wider">Cliente</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#666666] uppercase tracking-wider">Fecha inicio</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#666666] uppercase tracking-wider">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {clientes.map((cliente) => {
                const edad = cliente.birth_date
                  ? Math.floor((Date.now() - new Date(cliente.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                  : null

                return (
                  <tr key={cliente.id} className="hover:bg-[#F5F5F5]/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#FF914D]/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-[#FF914D]" />
                        </div>
                        <div>
                          <p className="font-medium text-[#1C1C1C]">
                            {cliente.first_name} {cliente.last_name}
                          </p>
                          {edad && (
                            <p className="text-xs text-[#666666]">{edad} años</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-[#666666]">
                      {cliente.start_date
                        ? new Date(cliente.start_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        cliente.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {cliente.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/dashboard/clientes/${cliente.id}`}
                        className="text-sm font-medium text-[#FF914D] hover:underline"
                      >
                        Ver detalle →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
