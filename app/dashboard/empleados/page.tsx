import Link from 'next/link'
import { UserPlus, User, Shield, Clock } from 'lucide-react'
import { getEmployeesAction } from '@/app/actions/employees'

export const dynamic = 'force-dynamic'

export default async function EmpleadosPage() {
  const employees = await getEmployeesAction()

  const activos = employees.filter(e => e.is_active)
  const inactivos = employees.filter(e => !e.is_active)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Empleats</h1>
          <p className="text-white/50 text-sm mt-1">
            {activos.length} actiu{activos.length !== 1 ? 's' : ''}
            {inactivos.length > 0 && ` · ${inactivos.length} inactiu${inactivos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/dashboard/empleados/nuevo"
          className="flex items-center gap-2 bg-[#FF914D] hover:bg-[#e07a3a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <UserPlus className="h-4 w-4" />
          Nou empleat
        </Link>
      </div>

      {employees.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-[#FF914D]/10 flex items-center justify-center mb-4">
            <UserPlus className="h-6 w-6 text-[#FF914D]" />
          </div>
          <h3 className="text-white font-semibold mb-1">Sense empleats</h3>
          <p className="text-white/40 text-sm mb-4">Afegeix el primer empleat del centre</p>
          <Link
            href="/dashboard/empleados/nuevo"
            className="flex items-center gap-2 bg-[#FF914D] hover:bg-[#e07a3a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Nou empleat
          </Link>
        </div>
      ) : (
        <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Empleat</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Rol</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider hidden md:table-cell">Incorporació</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider hidden lg:table-cell">Darrer accés</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-white/40 uppercase tracking-wider">Estat</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {employees.map(emp => (
                <tr key={emp.id} className={`hover:bg-white/5 transition-colors ${!emp.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#FF914D]/10 flex items-center justify-center shrink-0">
                        {emp.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={emp.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                        ) : (
                          <User className="h-4 w-4 text-[#FF914D]" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white">{emp.full_name}</p>
                        <p className="text-xs text-white/40">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <RoleBadge role={emp.role} />
                  </td>
                  <td className="px-5 py-4 text-sm text-white/50 hidden md:table-cell">
                    {emp.hire_date
                      ? new Date(emp.hire_date + 'T12:00:00').toLocaleDateString('ca-ES', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    {emp.last_sign_in ? (
                      <div className="flex items-center gap-1.5 text-xs text-white/40">
                        <Clock className="h-3 w-3" />
                        {new Date(emp.last_sign_in).toLocaleDateString('ca-ES', { day: '2-digit', month: 'short' })}
                      </div>
                    ) : (
                      <span className="text-xs text-white/20">Mai</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      emp.is_active
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-white/5 text-white/30 border border-white/10'
                    }`}>
                      {emp.is_active ? 'Actiu' : 'Inactiu'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/dashboard/empleados/${emp.id}`}
                      className="text-sm font-medium text-[#FF914D] hover:underline"
                    >
                      Veure →
                    </Link>
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

function RoleBadge({ role }: { role: 'employee' | 'admin' }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FF914D]/10 text-[#FF914D] border border-[#FF914D]/20">
        <Shield className="h-3 w-3" />
        Admin
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 text-white/50 border border-white/10">
      <User className="h-3 w-3" />
      Empleat
    </span>
  )
}
