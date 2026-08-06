'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Users, Dumbbell, CalendarDays, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  {
    title: 'Clientes',
    href: '/dashboard/clientes',
    icon: Users,
  },
  {
    title: 'Ejercicios',
    href: '/dashboard/ejercicios',
    icon: Dumbbell,
  },
  {
    title: 'Planes',
    href: '/dashboard/planes',
    icon: CalendarDays,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Sidebar className="border-r border-[#E5E5E5] bg-[#1C1C1C]">
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
            <span
              className="text-white text-sm font-black tracking-widest uppercase leading-tight"
              style={{ fontStyle: 'italic', transform: 'skewX(-8deg)', display: 'inline-block' }}
            >
              GIRONA <span className="text-[#FF914D]">ACTIVA</span>
            </span>
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

      {/* Footer */}
      <SidebarFooter className="px-3 py-4 border-t border-white/10">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer w-full"
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
