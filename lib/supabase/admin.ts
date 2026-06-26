import { createClient } from '@supabase/supabase-js'

// Cliente admin con SECRET_KEY — solo usar en Server Actions / Server Components
// NUNCA importar en Client Components
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
