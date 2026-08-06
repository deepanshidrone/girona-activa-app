import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, CalendarDays } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function PlanesPage() {
  const supabase = await createClient()

  const { data: planes } = await supabase
    .from('training_plans')
    .select(`
      id, type, level, status, duration_months, weekly_frequency,
      session_duration, start_date, end_date, created_at,
      clients (first_name, last_name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Planes de entrenamiento</h1>
          <p className="text-white/50 text-sm mt-1">{planes?.length ?? 0} plans en total</p>
        </div>
        <Link href="/dashboard/planes/nuevo">
          <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
            <Plus className="h-4 w-4" />
            Nuevo plan
          </Button>
        </Link>
      </div>

      {!planes || planes.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#FF914D]/10 flex items-center justify-center mb-4">
            <CalendarDays className="h-6 w-6 text-[#FF914D]" />
          </div>
          <h3 className="text-white font-semibold mb-1">No hay planes todavía</h3>
          <p className="text-white/40 text-sm mb-4">Crea el primer plan de entrenamiento</p>
          <Link href="/dashboard/planes/nuevo">
            <Button className="bg-[#FF914D] hover:bg-[#e07a3a] text-white font-semibold gap-2">
              <Plus className="h-4 w-4" /> Nuevo plan
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Cliente</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Duración</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {planes.map((plan: any) => (
                <tr key={plan.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-medium text-white">
                      {plan.clients?.first_name} {plan.clients?.last_name}
                    </p>
                    <p className="text-xs text-white/40">Nivel {plan.level}</p>
                  </td>
                  <td className="px-5 py-4 text-sm text-white/50 capitalize">{plan.type === 'individual' ? 'Individual' : 'Grupal'}</td>
                  <td className="px-5 py-4 text-sm text-white/50">
                    {plan.duration_months} mes{plan.duration_months > 1 ? 'es' : ''} · {plan.weekly_frequency}x/sem · {plan.session_duration} min
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      plan.status === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                      plan.status === 'draft' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      'bg-white/10 text-white/40 border border-white/10'
                    }`}>
                      {plan.status === 'active' ? 'Activo' : plan.status === 'draft' ? 'Borrador' : 'Completado'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {plan.status === 'active' && (
                      <Link href={`/dashboard/planes/${plan.id}/editar`}
                        className="text-sm font-medium text-[#FF914D] hover:underline">
                        Editar →
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
