import { notFound, redirect } from 'next/navigation'
import { getStaffUser, hasPermission } from '@/lib/auth/permissions'

// Sección CRM (docs/spec-crm.md D8). Hoy solo tiene Leads.
export default async function CrmPage() {
  const staff = await getStaffUser()
  if (!staff || !hasPermission(staff.role, 'leads.gestionar')) notFound()
  redirect('/dashboard/crm/leads')
}
