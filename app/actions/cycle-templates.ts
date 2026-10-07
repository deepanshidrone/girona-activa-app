'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export type TemplateSlotData = {
  day_of_week: number   // 0=Lun … 4=Vie
  session_time: string  // 'HH:MM'
  has_overlap: boolean
  max_clients: number
}

export type TemplateDayData = {
  day_index: number     // 0-19
  block_label: 'A' | 'B' | 'C'
}

export type CreateTemplateData = {
  name: string
  notes?: string
  days: TemplateDayData[]    // 20 entries
  slots: TemplateSlotData[]
}

export async function getTemplatesAction() {
  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('cycle_templates')
    .select(`
      id, name, notes, is_default, created_at,
      cycle_template_days(id, day_index, block_label),
      cycle_template_slots(id, day_of_week, session_time, has_overlap, max_clients)
    `)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) return { error: error.message, templates: [] }
  return { templates: data ?? [] }
}

export async function getTemplateByIdAction(id: string) {
  const adminSupabase = createAdminClient()
  const { data, error } = await adminSupabase
    .from('cycle_templates')
    .select(`
      id, name, notes, is_default, created_at,
      cycle_template_days(id, day_index, block_label),
      cycle_template_slots(id, day_of_week, session_time, has_overlap, max_clients)
    `)
    .eq('id', id)
    .single()

  if (error) return { error: error.message, template: null }
  return { template: data }
}

export async function createTemplateAction(data: CreateTemplateData) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  const { data: tmpl, error: tmplError } = await adminSupabase
    .from('cycle_templates')
    .insert({ name: data.name, notes: data.notes || null, created_by: session.user.id })
    .select()
    .single()

  if (tmplError) return { error: tmplError.message }

  const { error: daysError } = await adminSupabase
    .from('cycle_template_days')
    .insert(data.days.map(d => ({ template_id: tmpl.id, day_index: d.day_index, block_label: d.block_label })))

  if (daysError) return { error: daysError.message }

  const { error: slotsError } = await adminSupabase
    .from('cycle_template_slots')
    .insert(data.slots.map(s => ({ template_id: tmpl.id, ...s })))

  if (slotsError) return { error: slotsError.message }

  return { success: true, id: tmpl.id }
}

export async function updateTemplateAction(
  id: string,
  data: { name?: string; notes?: string; days?: TemplateDayData[]; slots?: TemplateSlotData[] }
) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  if (data.name !== undefined || data.notes !== undefined) {
    const { error } = await adminSupabase
      .from('cycle_templates')
      .update({ name: data.name, notes: data.notes ?? null })
      .eq('id', id)
    if (error) return { error: error.message }
  }

  if (data.days) {
    await adminSupabase.from('cycle_template_days').delete().eq('template_id', id)
    const { error } = await adminSupabase
      .from('cycle_template_days')
      .insert(data.days.map(d => ({ template_id: id, day_index: d.day_index, block_label: d.block_label })))
    if (error) return { error: error.message }
  }

  if (data.slots) {
    await adminSupabase.from('cycle_template_slots').delete().eq('template_id', id)
    const { error } = await adminSupabase
      .from('cycle_template_slots')
      .insert(data.slots.map(s => ({ template_id: id, ...s })))
    if (error) return { error: error.message }
  }

  return { success: true }
}

export async function deleteTemplateAction(id: string) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  // Prevent deleting the default template
  const { data: tmpl } = await adminSupabase.from('cycle_templates').select('is_default').eq('id', id).single()
  if (tmpl?.is_default) return { error: 'No se puede eliminar la plantilla por defecto' }

  const { error } = await adminSupabase.from('cycle_templates').delete().eq('id', id)
  if (error) return { error: error.message }
  return { success: true }
}

export async function duplicateTemplateAction(id: string, name: string) {
  const adminSupabase = createAdminClient()
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }

  const { data: src } = await adminSupabase
    .from('cycle_templates')
    .select('cycle_template_days(day_index, block_label), cycle_template_slots(day_of_week, session_time, has_overlap, max_clients)')
    .eq('id', id)
    .single()

  if (!src) return { error: 'Plantilla no encontrada' }

  const { data: newTmpl, error } = await adminSupabase
    .from('cycle_templates')
    .insert({ name, created_by: session.user.id })
    .select()
    .single()

  if (error) return { error: error.message }

  await adminSupabase.from('cycle_template_days').insert(
    (src.cycle_template_days as any[]).map(d => ({ template_id: newTmpl.id, day_index: d.day_index, block_label: d.block_label }))
  )
  await adminSupabase.from('cycle_template_slots').insert(
    (src.cycle_template_slots as any[]).map(s => ({ template_id: newTmpl.id, day_of_week: s.day_of_week, session_time: s.session_time, has_overlap: s.has_overlap, max_clients: s.max_clients }))
  )

  return { success: true, id: newTmpl.id }
}
