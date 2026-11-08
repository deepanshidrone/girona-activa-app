import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import { getStaffUser, hasPermission } from "@/lib/auth/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { countUnseenLeads } from "@/lib/leads/data"
import { BRAND } from "@/lib/brand"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staff = await getStaffUser()
  const canSeeKpis = !!staff && hasPermission(staff.role, 'indicadores.ver')
  // CRM: solo con leads.gestionar. null = sin permiso (no se pinta la entrada)
  const unseenLeads = staff && hasPermission(staff.role, 'leads.gestionar')
    ? await countUnseenLeads(createAdminClient())
    : null

  return (
    <SidebarProvider defaultOpen={true}>
      {/* --brand: color del centro (lib/brand.ts) para las pantallas nuevas */}
      <div className="flex min-h-screen w-full" style={{ '--brand': BRAND.primary } as React.CSSProperties}>
        <AppSidebar canSeeKpis={canSeeKpis} unseenLeads={unseenLeads} />
        <div className="flex-1 flex flex-col bg-[#111111]">
          {/* Topbar */}
          <header className="flex items-center gap-2 px-4 py-3 bg-[#1C1C1C] border-b border-white/10 sticky top-0 z-10">
            <SidebarTrigger className="text-white/50 hover:text-white" />
            <Separator orientation="vertical" className="h-4 bg-white/10" />
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
