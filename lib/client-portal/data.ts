import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { todayIn } from '@/lib/center'
import type { MiEjercicio, MiFicha, MiPlan, MiRegistro, MiRegistroEjercicio, MiSesion } from './types'
import type { MiFeedback } from './feedback'

// Datos de la vista de cliente. Lee SOLO las vistas mi_* y festivos_centro con
// la sesión del usuario (createClient), nunca con createAdminClient(): la base
// de datos filtra por la cuenta del cliente (migración
// 20261106140000_vista_cliente_lectura.sql). cache() evita repetir consultas
// entre el layout y la página en la misma petición.

export type Portal = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  email: string | null
  ficha: MiFicha | null
  today: string
}

export const getPortal = cache(async (): Promise<Portal | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'client') return null

  const { data: ficha } = await supabase.from('mi_ficha').select('*').maybeSingle()
  // Zona horaria fija hasta que center_settings sea legible por el cliente (§7.4)
  return { supabase, userId: user.id, email: user.email ?? null, ficha: (ficha as MiFicha | null) ?? null, today: todayIn() }
})

async function db() {
  const portal = await getPortal()
  if (!portal?.ficha) return null
  return portal.supabase
}

export const getMisSesiones = cache(async (): Promise<MiSesion[]> => {
  const supabase = await db()
  if (!supabase) return []
  const { data } = await supabase
    .from('mi_sesiones')
    .select('*')
    .order('session_date')
    .order('session_time', { nullsFirst: true })
  return (data ?? []) as MiSesion[]
})

export async function getSesion(sourceId: string): Promise<MiSesion | null> {
  const supabase = await db()
  if (!supabase) return null
  const { data } = await supabase.from('mi_sesiones').select('*').eq('source_id', sourceId).maybeSingle()
  return (data as MiSesion | null) ?? null
}

export async function getEjercicios(sourceIds: string[]): Promise<MiEjercicio[]> {
  const supabase = await db()
  if (!supabase || sourceIds.length === 0) return []
  const { data } = await supabase
    .from('mi_ejercicios_planificados')
    .select('*')
    .in('source_id', sourceIds)
    .order('order_index', { nullsFirst: false })
  return (data ?? []) as MiEjercicio[]
}

// Registro completado de una sesión (si lo hay) con sus ejercicios.
export async function getRegistro(sourceId: string): Promise<{ registro: MiRegistro; ejercicios: MiRegistroEjercicio[] } | null> {
  const supabase = await db()
  if (!supabase) return null
  const { data: registro } = await supabase
    .from('mi_registros')
    .select('*')
    .eq('source_id', sourceId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!registro) return null
  const { data: ejercicios } = await supabase
    .from('mi_registros_ejercicios')
    .select('*')
    .eq('session_log_id', registro.id)
  return { registro: registro as MiRegistro, ejercicios: (ejercicios ?? []) as MiRegistroEjercicio[] }
}

// Feedback del cliente (vista mi_feedback).
export const getMiFeedback = cache(async (): Promise<MiFeedback[]> => {
  const supabase = await db()
  if (!supabase) return []
  const { data } = await supabase.from('mi_feedback').select('*').order('created_at', { ascending: false })
  return (data ?? []) as MiFeedback[]
})

// Planes del cliente, del más reciente al más antiguo.
export const getPlanes = cache(async (): Promise<MiPlan[]> => {
  const supabase = await db()
  if (!supabase) return []
  const { data } = await supabase.from('mi_planes').select('*').order('start_date', { ascending: false })
  return (data ?? []) as MiPlan[]
})

export async function getFestivos(from: string, to: string): Promise<{ date: string; name: string }[]> {
  const supabase = await db()
  if (!supabase) return []
  const { data } = await supabase.from('festivos_centro').select('date, name').gte('date', from).lte('date', to)
  return data ?? []
}
