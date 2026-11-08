'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, CalendarDays, TrendingUp, User } from 'lucide-react'

const TABS = [
  { href: '/client', label: 'Hoy', icon: Home, match: (p: string) => p === '/client' },
  { href: '/client/calendario', label: 'Calendario', icon: CalendarDays,
    match: (p: string) => p.startsWith('/client/calendario') || p.startsWith('/client/sesion') || p.startsWith('/client/historial') },
  { href: '/client/progreso', label: 'Progreso', icon: TrendingUp, match: (p: string) => p.startsWith('/client/progreso') },
  { href: '/client/perfil', label: 'Perfil', icon: User, match: (p: string) => p.startsWith('/client/perfil') },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 bg-[#1C1C1C] border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
      <ul className="max-w-md mx-auto grid grid-cols-4">
        {TABS.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-medium transition-colors ${
                  active ? 'text-[var(--brand)]' : 'text-white/45 hover:text-white/80'
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
