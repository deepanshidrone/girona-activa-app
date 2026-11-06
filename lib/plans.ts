import 'server-only'

import type { createAdminClient } from '@/lib/supabase/admin'
import { addDays } from '@/lib/center'

type AdminClient = ReturnType<typeof createAdminClient>

// Un plan nuevo necesita un entrenador asignado (los KPIs atribuyen a él al
// cliente) y un cliente de alta: a un cliente de baja hay que reactivarlo antes.
// Devuelve el mensaje de error, o null si se puede crear.
export async function checkClientCanGetPlan(
  admin: AdminClient,
  clientId: string,
  employeeId: string | null | undefined,
): Promise<string | null> {
  if (!employeeId) return 'Elige el entrenador asignado al plan'

  const { data: openPeriod, error } = await admin
    .from('client_periods')
    .select('id')
    .eq('client_id', clientId)
    .is('ended_on', null)
    .maybeSingle()
  if (error) return 'Error al comprobar el estado del cliente: ' + error.message
  if (!openPeriod) return 'El cliente está de baja. Reactívalo desde su ficha antes de crearle un plan.'
  return null
}

// Al crear un plan nuevo, el plan activo anterior pasa a 'completed' y su fin
// efectivo (ended_on) es el día antes del inicio del nuevo, si es anterior a su
// fecha de fin prevista (docs/spec-kpis.md §5.2).
export async function closeReplacedPlans(
  admin: AdminClient,
  clientId: string,
  newStartDate: string,
): Promise<string | null> {
  const { data: actives, error } = await admin
    .from('training_plans')
    .select('id, start_date, end_date')
    .eq('client_id', clientId)
    .eq('status', 'active')
  if (error) return 'Error al cerrar el plan anterior: ' + error.message

  const dayBefore = addDays(newStartDate, -1)
  for (const plan of actives ?? []) {
    let endedOn: string | null = null
    if (plan.end_date > dayBefore) {
      endedOn = dayBefore < plan.start_date ? plan.start_date : dayBefore
    }
    const { error: updError } = await admin
      .from('training_plans')
      .update({ status: 'completed', ended_on: endedOn })
      .eq('id', plan.id)
    if (updError) return 'Error al cerrar el plan anterior: ' + updError.message
  }
  return null
}
