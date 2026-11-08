import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getPortal } from '@/lib/client-portal/data'
import { BRAND } from '@/lib/client-portal/brand'
import { BottomNav } from './bottom-nav'
import { EmptyState } from './ui'

// Vista de cliente (móvil). Especificación: docs/spec-vista-cliente.md
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const portal = await getPortal()
  if (!portal) redirect('/login')

  return (
    <div
      className="min-h-screen bg-[#111111] text-white flex flex-col"
      style={{ '--brand': BRAND.primary } as React.CSSProperties}
    >
      <header className="bg-[#1C1C1C] border-b border-white/10 sticky top-0 z-20">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10">
              <Image src={BRAND.logoUrl} alt={BRAND.name} width={32} height={32} className="object-cover w-full h-full" />
            </div>
            <span className="text-sm font-semibold tracking-wider italic">{BRAND.shortName}</span>
          </div>
          {portal.ficha && <span className="text-sm text-white/60">Hola, {portal.ficha.first_name}</span>}
        </div>
      </header>

      {portal.ficha ? (
        <>
          <main className="flex-1 w-full max-w-md mx-auto px-4 pt-5 pb-28">{children}</main>
          <BottomNav />
        </>
      ) : (
        <main className="flex-1 w-full max-w-md mx-auto px-4 pt-5">
          <EmptyState title="Sin perfil asignado" text="Tu cuenta no está enlazada a ninguna ficha. Contacta con tu centro." />
          <a href="/logout" className="block text-center text-sm text-white/50 mt-6 py-3">Cerrar sesión</a>
        </main>
      )}
    </div>
  )
}
