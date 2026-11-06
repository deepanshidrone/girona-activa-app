'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

// Objetivos y umbrales de los indicadores (docs/spec-kpis.md §6).
// Solo el admin: además del permiso del panel se exige el rol (también lo
// exige la RLS de kpi_targets para el acceso directo por API).

export type KpiTargetUpdate = { key: string; value_min: number | null; value_max: number | null }

export async function updateKpiTargetsAction(updates: KpiTargetUpdate[]) {
  const auth = await requirePermission('indicadores.ver')
  if (!auth.user) return { error: auth.error }
  if (auth.user.role !== 'admin') return { error: 'Solo el admin puede cambiar los objetivos' }
  if (!Array.isArray(updates) || updates.length === 0 || updates.length > 50) return { error: 'Nada que guardar' }

  const admin = createAdminClient()
  const { data: existing } = await admin.from('kpi_targets').select('key, unit')
  const units = new Map((existing ?? []).map(t => [t.key, t.unit]))

  for (const u of updates) {
    const unit = units.get(u.key)
    if (!unit) return { error: `Objetivo desconocido: ${u.key}` }
    for (const v of [u.value_min, u.value_max]) {
      if (v === null) continue
      if (!Number.isFinite(v) || v < 0) return { error: 'Los objetivos deben ser números positivos' }
      if (unit === '%' && v > 100) return { error: 'Un porcentaje no puede pasar de 100' }
      if (unit === 'días' && v > 365) return { error: 'Como máximo 365 días' }
    }
    if (u.value_min !== null && u.value_max !== null && u.value_min > u.value_max) {
      return { error: 'El mínimo no puede ser mayor que el máximo' }
    }
  }

  for (const u of updates) {
    const { error } = await admin
      .from('kpi_targets')
      .update({ value_min: u.value_min, value_max: u.value_max, updated_by: auth.user.id, updated_at: new Date().toISOString() })
      .eq('key', u.key)
    if (error) return { error: 'Error al guardar: ' + error.message }
  }

  revalidatePath('/dashboard/indicadores')
  return { success: true }
}
