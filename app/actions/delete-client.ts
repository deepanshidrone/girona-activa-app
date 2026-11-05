'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'

export async function deleteClientAction(clientId: string) {
  const auth = await requirePermission('clientes.borrar')
  if (!auth.user) return { error: auth.error }
  const adminSupabase = createAdminClient()

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
