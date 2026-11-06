import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { UserPlus, User } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffUser } from '@/lib/auth/permissions'
import { getCenterToday } from '@/lib/center-settings'
import { ageOn, formatDateEs } from '@/lib/center'
import { CLIENT_STATE_BADGE, CLIENT_STATE_LABEL, type ClientState } from '@/lib/client-state'

export const dynamic = 'force-dynamic'

type Filter = 'alta' | 'active' | 'inactive' | 'baja' | 'todos'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'alta', label: 'De alta' },
  { key: 'active', label: 'Activos' },
  { key: 'inactive', label: 'Inactivos' },
  { key: 'baja', label: 'Baja' },
  { key: 'todos', label: 'Todos' },
]

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const staff = await getStaffUser()
  if (!staff) notFound()

  const params = await searchParams
  const filter: Filter = FILTERS.some(f => f.key === params.estado) ? (params.estado as Filter) : 'alta'

  const supabase = createAdminClient()
  const today = await getCenterToday(supabase)

  const [{ data: clientes }, { data: states }] = await Promise.all([
    supabase
      .from('clients')
      .select('id, first_name, last_name, birth_date, start_date')
      .order('created_at', { ascending: false }),
    supabase.rpc('kpi_client_states', { p_date: today }),
  ])

  const stateById = new Map<string, ClientState>(
    ((states ?? []) as { client_id: string; state: ClientState }[]).map(s => [s.client_id, s.state]),
  )
  // Un cliente con fecha de inicio futura aún no tiene estado: se muestra como inactivo
  const rows = (clientes ?? []).map(c => ({ ...c, state: stateById.get(c.id) ?? ('inactive' as ClientState) }))

  const counts = { active: 0, inactive: 0, baja: 0 }
  for (const r of rows) counts[r.state]++

  const visible = rows.filter(r => {
    if (filter === 'todos') return true
    if (filter === 'alta') return r.state !== 'baja'
    return r.state === filter
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Clientes</h1>
          <p className="text-white/50 text-sm mt-1">
            {counts.active} activos · {counts.inactive} inactivos · {counts.baja} de baja
          </p>
        </div>
        <Link href="/dashboard/clientes/nuevo">
          <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
            <UserPlus className="h-4 w-4" />
            Nuevo cliente
          </Button>
        </Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <Link
            key={f.key}
            href={f.key === 'alta' ? '/dashboard/clientes' : `/dashboard/clientes?estado=${f.key}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key ? 'bg-[#FF914D] text-white' : 'bg-[#1C1C1C] text-white/60 border border-white/10 hover:text-white'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#FF914D]/10 flex items-center justify-center mb-4">
            <UserPlus className="h-6 w-6 text-[#FF914D]" />
          </div>
          <h3 className="text-white font-semibold mb-1">No hay clientes todavía</h3>
          <p className="text-white/40 text-sm mb-4">Empieza dando de alta a tu primer cliente</p>
          <Link href="/dashboard/clientes/nuevo">
            <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
              <UserPlus className="h-4 w-4" />
              Nuevo cliente
            </Button>
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-10 text-center text-sm text-white/40">
          No hay clientes con este estado.
        </div>
      ) : (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 overflow-x-auto">
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
              {visible.map((cliente) => {
                const edad = ageOn(cliente.birth_date, today)

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
                          {edad && <p className="text-xs text-white/40">{edad} años</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-white/50">{formatDateEs(cliente.start_date)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CLIENT_STATE_BADGE[cliente.state]}`}>
                        {CLIENT_STATE_LABEL[cliente.state]}
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
