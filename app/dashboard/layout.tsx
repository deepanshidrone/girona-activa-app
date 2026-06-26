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
        <div className="flex-1 flex flex-col bg-[#F5F5F5]">
          {/* Topbar con toggle */}
          <header className="flex items-center gap-2 px-4 py-3 bg-white border-b border-[#E5E5E5] sticky top-0 z-10">
            <SidebarTrigger className="text-[#666666] hover:text-[#1C1C1C]" />
            <Separator orientation="vertical" className="h-4" />
          </header>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  )
}
