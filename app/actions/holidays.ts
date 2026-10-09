'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export type Holiday = {
  date: string        // 'YYYY-MM-DD'
  name: string
  scope: 'national' | 'catalonia' | 'girona'
  is_active: boolean
  is_override: boolean
}

// Returns all holidays as a Set<string> of 'YYYY-MM-DD' for fast lookup
export async function getActiveHolidayDatesAction(year?: number): Promise<Set<string>> {
  const adminSupabase = createAdminClient()
  let query = adminSupabase
    .from('public_holidays')
    .select('date')
    .eq('is_active', true)

  if (year) {
    query = query.gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
  }

  const { data } = await query
  return new Set((data ?? []).map(h => h.date))
}

export async function getHolidaysAction(yearStart?: number, yearEnd?: number): Promise<Holiday[]> {
  const adminSupabase = createAdminClient()
  let query = adminSupabase
    .from('public_holidays')
    .select('date, name, scope, is_active, is_override')
    .order('date')

  if (yearStart) query = query.gte('date', `${yearStart}-01-01`)
  if (yearEnd)   query = query.lte('date', `${yearEnd}-12-31`)

  const { data } = await query
  return (data ?? []) as Holiday[]
}

export async function toggleHolidayAction(date: string): Promise<{ error?: string }> {
  const adminSupabase = createAdminClient()

  const { data: existing } = await adminSupabase
    .from('public_holidays')
    .select('is_active')
    .eq('date', date)
    .single()

  if (existing) {
    const { error } = await adminSupabase
      .from('public_holidays')
      .update({ is_active: !existing.is_active, is_override: true })
      .eq('date', date)
    if (error) return { error: error.message }
  } else {
    // Manually added holiday
    const { error } = await adminSupabase
      .from('public_holidays')
      .insert({ date, name: 'Festivo añadido manualmente', scope: 'girona', is_active: true, is_override: true })
    if (error) return { error: error.message }
  }

  return {}
}

export async function addHolidayAction(date: string, name: string): Promise<{ error?: string }> {
  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase
    .from('public_holidays')
    .upsert({ date, name, scope: 'girona', is_active: true, is_override: true }, { onConflict: 'date' })
  if (error) return { error: error.message }
  return {}
}

// Sync from Nager.Date API — call once per year (e.g., from a future settings page)
export async function syncHolidaysFromApiAction(year: number): Promise<{ synced: number; error?: string }> {
  const adminSupabase = createAdminClient()

  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ES`, {
      next: { revalidate: 86400 },
    })
    if (!res.ok) return { synced: 0, error: 'Error al conectar con Nager.Date' }

    const apiHolidays: { date: string; localName: string; counties: string[] | null; global: boolean }[] = await res.json()

    const toInsert = apiHolidays
      .filter(h => h.global || (h.counties ?? []).some(c => c === 'ES-CT'))
      .map(h => ({
        date: h.date,
        name: h.localName,
        scope: h.global ? 'national' : 'catalonia',
        is_active: true,
        is_override: false,
      }))

    const { error } = await adminSupabase
      .from('public_holidays')
      .upsert(toInsert, { onConflict: 'date', ignoreDuplicates: false })

    if (error) return { synced: 0, error: error.message }
    return { synced: toInsert.length }
  } catch (e) {
    return { synced: 0, error: String(e) }
  }
}
