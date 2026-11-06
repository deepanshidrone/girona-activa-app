import 'server-only'

import type { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_TIMEZONE, todayIn } from '@/lib/center'

type AdminClient = ReturnType<typeof createAdminClient>

export async function getCenterTimezone(admin: AdminClient): Promise<string> {
  const { data } = await admin.from('center_settings').select('timezone').eq('id', 1).maybeSingle()
  return data?.timezone ?? DEFAULT_TIMEZONE
}

// "Hoy" en la zona horaria del centro, como 'YYYY-MM-DD'.
export async function getCenterToday(admin: AdminClient): Promise<string> {
  return todayIn(await getCenterTimezone(admin))
}
