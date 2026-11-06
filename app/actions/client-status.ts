'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { getCenterToday } from '@/lib/center-settings'
import { isIsoDate } from '@/lib/center'

// Baja y reactivación del cliente (docs/spec-kpis.md §8).
// La baja es siempre manual: cierra el periodo de alta abierto con fecha y
// motivo, cancela el plan vigente y quita las sesiones futuras sin registro.
// El historial pasado no se toca.

export type DeactivateClientData = {
  clientId: string
  date: string        // fecha de baja, 'YYYY-MM-DD' (hoy o pasada)
  reasonId: string
  notes?: string
}

export async function deactivateClientAction(data: DeactivateClientData) {
  const auth = await requirePermission('clientes.baja')
  if (!auth.user) return { error: auth.error }
  const admin = createAdminClient()

  if (!isIsoDate(data.date)) return { error: 'La fecha de baja no es válida' }
  const today = await getCenterToday(admin)
  if (data.date > today) return { error: 'La fecha de baja no puede ser futura' }

  const { data: reason } = await admin
    .from('client_end_reasons')
    .select('id, requires_notes, is_active')
    .eq('id', data.reasonId)
    .maybeSingle()
  if (!reason || !reason.is_active) return { error: 'Elige un motivo de baja' }
  const notes = data.notes?.trim() || null
  if (reason.requires_notes && !notes) return { error: 'Explica el motivo en el comentario' }

  const { data: period } = await admin
    .from('client_periods')
    .select('id, started_on')
    .eq('client_id', data.clientId)
    .is('ended_on', null)
    .maybeSingle()
  if (!period) return { error: 'Este cliente ya está de baja' }
  if (data.date < period.started_on) {
    return { error: 'La fecha de baja no puede ser anterior a la fecha de alta' }
  }

  // 1. Cerrar el periodo de alta
  const { error: periodError } = await admin
    .from('client_periods')
    .update({
      ended_on: data.date,
      end_reason_id: reason.id,
      end_notes: notes,
      ended_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', period.id)
  if (periodError) return { error: 'Error al dar de baja: ' + periodError.message }

  // 2. Planes: los que aún no habían empezado se borran (si no tienen registros);
  //    el que sigue vigente en la fecha de baja se cancela con fin efectivo = baja.
  const { data: plans } = await admin
    .from('training_plans')
    .select('id, start_date, end_date, ended_on, status')
    .eq('client_id', data.clientId)
    .neq('status', 'draft')

  for (const plan of plans ?? []) {
    const effEnd = plan.ended_on ?? plan.end_date
    if (plan.start_date > data.date) {
      const { count } = await admin
        .from('session_logs')
        .select('id, plan_sessions!inner(plan_id)', { count: 'exact', head: true })
        .eq('plan_sessions.plan_id', plan.id)
      if (!count) {
        await admin.from('training_plans').delete().eq('id', plan.id)
        continue
      }
    }
    if (effEnd >= data.date) {
      await admin
        .from('training_plans')
        .update({ status: 'cancelled', ended_on: data.date })
        .eq('id', plan.id)
    }
  }

  // 3. Sesiones individuales posteriores a la baja sin registro
  const planIds = (plans ?? []).map(p => p.id)
  if (planIds.length > 0) {
    const { data: futureSessions } = await admin
      .from('plan_sessions')
      .select('id, session_logs(id)')
      .in('plan_id', planIds)
      .gt('session_date', data.date)
    const toDelete = (futureSessions ?? [])
      .filter(s => !s.session_logs || (s.session_logs as unknown[]).length === 0)
      .map(s => s.id)
    if (toDelete.length > 0) {
      await admin.from('plan_sessions').delete().in('id', toDelete)
    }
  }

  // 4. Plazas en sesiones grupales posteriores a la baja
  const { data: groupSeats } = await admin
    .from('training_session_clients')
    .select('id, training_sessions!inner(session_date)')
    .eq('client_id', data.clientId)
    .gt('training_sessions.session_date', data.date)
  const seatIds = (groupSeats ?? []).map(s => s.id)
  if (seatIds.length > 0) {
    await admin.from('training_session_clients').delete().in('id', seatIds)
  }

  revalidatePath('/dashboard/clientes')
  revalidatePath(`/dashboard/clientes/${data.clientId}`)
  return { success: true }
}

export async function reactivateClientAction(data: { clientId: string; date: string }) {
  const auth = await requirePermission('clientes.baja')
  if (!auth.user) return { error: auth.error }
  const admin = createAdminClient()

  if (!isIsoDate(data.date)) return { error: 'La fecha de reactivación no es válida' }
  const today = await getCenterToday(admin)
  if (data.date > today) return { error: 'La fecha de reactivación no puede ser futura' }

  const { data: periods } = await admin
    .from('client_periods')
    .select('id, ended_on')
    .eq('client_id', data.clientId)
    .order('started_on', { ascending: false })
  if (!periods || periods.length === 0) return { error: 'Cliente no encontrado' }
  if (periods.some(p => p.ended_on === null)) return { error: 'Este cliente ya está de alta' }

  const lastEnd = periods[0].ended_on as string
  if (data.date < lastEnd) {
    return { error: 'La reactivación no puede ser anterior a la última baja' }
  }

  const { error } = await admin.from('client_periods').insert({
    client_id: data.clientId,
    started_on: data.date,
    started_by: auth.user.id,
  })
  if (error) return { error: 'Error al reactivar: ' + error.message }

  revalidatePath('/dashboard/clientes')
  revalidatePath(`/dashboard/clientes/${data.clientId}`)
  return { success: true }
}
