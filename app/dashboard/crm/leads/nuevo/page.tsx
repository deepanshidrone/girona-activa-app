import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffUser, hasPermission } from '@/lib/auth/permissions'
import { getLeadFormCatalog } from '@/lib/leads/data'
import { LeadForm } from './lead-form'

// Alta manual de un lead (docs/spec-crm.md §16). Solo con leads.gestionar.
export const dynamic = 'force-dynamic'

export default async function NewLeadPage() {
  const staff = await getStaffUser()
  if (!staff || !hasPermission(staff.role, 'leads.gestionar')) notFound()

  const admin = createAdminClient()
  const [catalog, { data: settings }] = await Promise.all([
    getLeadFormCatalog(admin),
    admin.from('center_settings').select('default_country_code').eq('id', 1).maybeSingle(),
  ])

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 max-w-3xl">
      <Link href="/dashboard/crm/leads" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white w-fit">
        <ArrowLeft className="h-4 w-4" /> Leads
      </Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">CRM</p>
        <h1 className="text-2xl font-bold text-white">Nuevo lead</h1>
        <p className="text-white/50 text-sm mt-1">Para alguien que se ha interesado en el centro sin pasar por la web.</p>
      </div>
      <LeadForm catalog={catalog} countryCode={settings?.default_country_code ?? '34'} />
    </div>
  )
}
