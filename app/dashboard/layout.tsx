import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
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
