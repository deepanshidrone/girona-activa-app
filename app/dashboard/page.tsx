import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Dumbbell, CalendarDays } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createAdminClient()

  const [
    { count: totalClientes },
    { count: totalEjercicios },
    { count: totalPlanes },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('exercises').select('*', { count: 'exact', head: true }),
    supabase.from('training_plans').select('*', { count: 'exact', head: true }).eq('status', 'active'),
  ])

  const stats = [
    {
      title: 'Clientes activos',
      value: totalClientes ?? '—',
      icon: Users,
      description: 'Total de clientes dados de alta',
      href: '/dashboard/clientes',
    },
    {
      title: 'Ejercicios',
      value: totalEjercicios ?? '—',
      icon: Dumbbell,
      description: 'En la galería',
      href: '/dashboard/ejercicios',
    },
    {
      title: 'Planes activos',
      value: totalPlanes ?? '—',
      icon: CalendarDays,
      description: 'Planes asignados actualmente',
      href: '/dashboard/planes',
    },
  ]

  return (
    <div className="p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1C1C1C]">Panel de control</h1>
        <p className="text-[#666666] text-sm mt-1">Bienvenido al centro de gestión de Girona Activa</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="bg-white border-[#E5E5E5] shadow-none hover:border-[#FF914D] transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-[#666666]">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-[#FF914D]" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-[#1C1C1C]">{stat.value}</div>
                <p className="text-xs text-[#666666] mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-[#666666] uppercase tracking-wider mb-3">
          Acciones rápidas
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/dashboard/clientes/nuevo" className="flex items-center gap-3 bg-white border border-[#E5E5E5] rounded-xl px-4 py-4 hover:border-[#FF914D] transition-colors group">
            <div className="w-9 h-9 rounded-lg bg-[#FF914D]/10 flex items-center justify-center shrink-0">
              <Users className="h-4 w-4 text-[#FF914D]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#1C1C1C] group-hover:text-[#FF914D] transition-colors">Nuevo cliente</p>
              <p className="text-xs text-[#666666]">Dar de alta a un cliente</p>
            </div>
          </Link>
          <Link href="/dashboard/planes/nuevo" className="flex items-center gap-3 bg-white border border-[#E5E5E5] rounded-xl px-4 py-4 hover:border-[#FF914D] transition-colors group">
            <div className="w-9 h-9 rounded-lg bg-[#FF914D]/10 flex items-center justify-center shrink-0">
              <CalendarDays className="h-4 w-4 text-[#FF914D]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#1C1C1C] group-hover:text-[#FF914D] transition-colors">Nuevo plan</p>
              <p className="text-xs text-[#666666]">Generar plan de entrenamiento</p>
            </div>
          </Link>
          <Link href="/dashboard/ejercicios" className="flex items-center gap-3 bg-white border border-[#E5E5E5] rounded-xl px-4 py-4 hover:border-[#FF914D] transition-colors group">
            <div className="w-9 h-9 rounded-lg bg-[#FF914D]/10 flex items-center justify-center shrink-0">
              <Dumbbell className="h-4 w-4 text-[#FF914D]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#1C1C1C] group-hover:text-[#FF914D] transition-colors">Ejercicios</p>
              <p className="text-xs text-[#666666]">Gestionar la galería</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
