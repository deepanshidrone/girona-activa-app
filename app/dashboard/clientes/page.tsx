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
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-white/50 text-sm mt-1">
            {clientes?.length ?? 0} client{clientes?.length !== 1 ? 's' : ''} en total
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
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#FF914D]/10 flex items-center justify-center mb-4">
            <UserPlus className="h-6 w-6 text-[#FF914D]" />
          </div>
          <h3 className="text-white font-semibold mb-1">No hay clientes todavía</h3>
          <p className="text-white/40 text-sm mb-4">Empieza donant d&apos;alta el teu primer client</p>
          <Link href="/dashboard/clientes/nuevo">
            <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
              <UserPlus className="h-4 w-4" />
              Nuevo cliente
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Fecha inicio</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {clientes.map((cliente) => {
                const edad = cliente.birth_date
                  ? Math.floor((Date.now() - new Date(cliente.birth_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                  : null

                return (
                  <tr key={cliente.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#FF914D]/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-[#FF914D]" />
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {cliente.first_name} {cliente.last_name}
                          </p>
                          {edad && (
                            <p className="text-xs text-white/40">{edad} anys</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50">
                      {cliente.start_date
                        ? new Date(cliente.start_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        cliente.is_active
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-white/10 text-white/40 border border-white/10'
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
