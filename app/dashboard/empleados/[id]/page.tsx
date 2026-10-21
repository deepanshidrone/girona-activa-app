import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Shield, Calendar, Phone, Dumbbell, Clock } from 'lucide-react'
import { getEmployeeByIdAction, getEmployeeSessionsAction } from '@/app/actions/employees'
import { EmployeeEditForm } from './edit-form'
import { PasswordChangeForm } from './password-form'

export const dynamic = 'force-dynamic'

export default async function EmpleatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [employee, sessions] = await Promise.all([
    getEmployeeByIdAction(id),
    getEmployeeSessionsAction(id),
  ])

  if (!employee) notFound()

  const initials = employee.full_name
    .split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/dashboard/empleados" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#FF914D]/10 flex items-center justify-center shrink-0 ring-1 ring-white/10 overflow-hidden">
            {employee.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={employee.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-[#FF914D]">{initials}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{employee.full_name}</h1>
              <RoleBadge role={employee.role} />
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <p className="text-white/40 text-sm">{employee.email}</p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                employee.is_active
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-white/5 text-white/30 border border-white/10'
              }`}>
                {employee.is_active ? 'Actiu' : 'Inactiu'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left column: quick info + sessions */}
        <div className="md:col-span-1 flex flex-col gap-4">
          {/* Quick info */}
          <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5">
            <h2 className="font-semibold text-white mb-4">Informació</h2>
            <dl className="flex flex-col gap-3">
              {employee.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-white/25 shrink-0" />
                  <span className="text-sm text-white/70">{employee.phone}</span>
                </div>
              )}
              {employee.hire_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-white/25 shrink-0" />
                  <span className="text-sm text-white/70">
                    Incorporació: {new Date(employee.hire_date + 'T12:00:00').toLocaleDateString('ca-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              )}
              {employee.last_sign_in && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-white/25 shrink-0" />
                  <span className="text-sm text-white/40">
                    Darrer accés: {new Date(employee.last_sign_in).toLocaleDateString('ca-ES', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              )}
            </dl>
            {employee.specialties.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Dumbbell className="h-3 w-3" />
                  Especialitats
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {employee.specialties.map(s => (
                    <span key={s} className="px-2.5 py-1 text-xs bg-[#FF914D]/10 text-[#FF914D] rounded-lg border border-[#FF914D]/20">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sessions assigned */}
          <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5">
            <h2 className="font-semibold text-white mb-3">Sessions assignades</h2>
            {sessions.length === 0 ? (
              <p className="text-white/30 text-sm">Sense sessions assignades</p>
            ) : (
              <div className="flex flex-col gap-2">
                {sessions.slice(0, 8).map((slot: any) => (
                  <div key={slot.id} className="flex items-center gap-2 py-1.5 border-b border-white/[0.06] last:border-0">
                    <span className="w-6 h-6 rounded-full bg-[#FF914D]/15 text-[#FF914D] text-xs font-bold flex items-center justify-center shrink-0">
                      {slot.block_label}
                    </span>
                    <span className="text-xs text-white/60">Dia {slot.day_index + 1} · {slot.session_time.slice(0, 5)}</span>
                    <span className="text-xs text-white/30 ml-auto">{slot.group_cycle_slot_clients?.length ?? 0}/{slot.max_clients}</span>
                  </div>
                ))}
                {sessions.length > 8 && (
                  <p className="text-xs text-white/30 text-center pt-1">+{sessions.length - 8} més</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right column: edit form + password */}
        <div className="md:col-span-2 flex flex-col gap-4">
          <EmployeeEditForm employee={employee} />
          <PasswordChangeForm employeeId={employee.id} employeeName={employee.full_name} />
        </div>
      </div>
    </div>
  )
}

function RoleBadge({ role }: { role: 'employee' | 'admin' }) {
  if (role === 'admin') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FF914D]/10 text-[#FF914D] border border-[#FF914D]/20">
        <Shield className="h-3 w-3" />Admin
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/5 text-white/50 border border-white/10">
      <User className="h-3 w-3" />Empleat
    </span>
  )
}
