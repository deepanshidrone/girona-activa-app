'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Users, Dumbbell, CalendarDays, LogOut, UserCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { title: 'Clientes', href: '/dashboard/clientes', icon: Users },
  { title: 'Ejercicios', href: '/dashboard/ejercicios', icon: Dumbbell },
  { title: 'Planes', href: '/dashboard/planes', icon: CalendarDays },
]

interface UserInfo {
  name: string
  email: string
  avatarUrl: string | null
  role: string
}

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()
      setUserInfo({
        name: profile?.full_name ?? '',
        email: user.email ?? '',
        avatarUrl: profile?.avatar_url ?? null,
        role: user.app_metadata?.role === 'client' ? 'Cliente' : 'Empleado',
      })
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userInfo?.name
    ? userInfo.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : userInfo?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <Sidebar className="border-r border-white/10 bg-[#1C1C1C]">
      {/* Header */}
      <SidebarHeader className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="w-11 h-11 rounded-full overflow-hidden shrink-0 block ring-1 ring-white/20">
            <Image
              src="/logo.png"
              alt="Girona Activa"
              width={44}
              height={44}
              className="object-cover w-full h-full"
            />
          </Link>
          <div className="flex flex-col">
            <div className="flex gap-1.5 items-baseline" style={{ fontStyle: 'italic', transform: 'skewX(-8deg)' }}>
              <span className="text-white text-sm font-black tracking-widest uppercase leading-tight">
                GIRONA
              </span>
              <span className="text-[#FF914D] text-sm font-black tracking-widest uppercase leading-tight">
                ACTIVA
              </span>
            </div>
            <span className="text-white/30 text-[10px] tracking-widest uppercase">
              Centre d&apos;Entrenament
            </span>
          </div>
        </div>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className="px-3 py-4">
        <SidebarMenu className="gap-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  className={`
                    rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-[#FF914D] text-white hover:bg-[#FF914D]'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  <Link href={item.href} className="flex items-center gap-3 w-full">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.title}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer — user + logout */}
      <SidebarFooter className="px-3 py-4 border-t border-white/10">
        <SidebarMenu className="gap-1">
          {/* User profile */}
          <SidebarMenuItem>
            <SidebarMenuButton
              className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                pathname === '/dashboard/perfil'
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Link href="/dashboard/perfil" className="flex items-center gap-3 w-full">
                <div className="w-7 h-7 rounded-full overflow-hidden bg-[#FF914D]/20 flex items-center justify-center shrink-0 ring-1 ring-white/10">
                  {userInfo?.avatarUrl ? (
                    <Image
                      src={userInfo.avatarUrl}
                      alt="Avatar"
                      width={28}
                      height={28}
                      className="object-cover w-full h-full"
                      unoptimized
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-[#FF914D]">{initials}</span>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white truncate leading-tight">
                    {userInfo?.name || userInfo?.email?.split('@')[0] || '…'}
                  </span>
                  <span className="text-[10px] text-white/30 leading-tight">{userInfo?.role}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Logout */}
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/50 hover:bg-white/10 hover:text-white transition-colors cursor-pointer w-full"
            >
              <div className="flex items-center gap-3">
                <LogOut className="h-4 w-4 shrink-0" />
                Cerrar sesión
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
