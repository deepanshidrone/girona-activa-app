'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function deleteClientAction(clientId: string) {
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'No autorizado' }
  if (session.user.app_metadata?.role !== 'employee') return { error: 'No autorizado' }

  // Obtener el user_id del cliente para borrar también de auth
  const { data: cliente } = await adminSupabase
    .from('clients')
    .select('user_id')
    .eq('id', clientId)
    .single()

  // Borrar fila de clients (cascada borrará planes y sesiones si está configurado)
  const { error: clientError } = await adminSupabase
    .from('clients')
    .delete()
    .eq('id', clientId)

  if (clientError) return { error: 'Error al eliminar el cliente: ' + clientError.message }

  // Borrar usuario de auth si existe
  if (cliente?.user_id) {
    await adminSupabase.auth.admin.deleteUser(cliente.user_id)
  }

  return { success: true }
}
