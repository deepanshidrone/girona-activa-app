import 'server-only'

import { createClient } from '@/lib/supabase/server'

// Control de acceso para Server Actions y Server Components.
//
// Cada Server Action se puede invocar con un POST directo, sin pasar por la UI,
// así que TODAS deben llamar a requireStaff() o requirePermission() antes de
// usar createAdminClient() (que se salta RLS).
//
// El rol se lee de app_metadata.role con getUser(), que valida la sesión contra
// Supabase Auth. No usar getSession() para decidir permisos: en el servidor no
// verifica el token. app_metadata solo lo puede cambiar el servidor con la
// clave secreta; profiles.role es una copia informativa.

export type StaffRole = 'admin' | 'employee'

export type StaffUser = {
  id: string
  email: string | null
  role: StaffRole
}

// Acciones que el admin puede conceder o quitar al rol employee.
// El admin siempre las tiene todas.
export type Permission =
  | 'clientes.borrar'
  | 'clientes.baja'
  | 'empleados.gestionar'
  | 'indicadores.ver'

// Valores fijos hasta que exista la página de Configuración (sección
// "Permisos por rol", solo admin). Entonces se leerán de base de datos y las
// acciones no tendrán que cambiar.
const EMPLOYEE_PERMISSIONS: Record<Permission, boolean> = {
  'clientes.borrar': false,
  'clientes.baja': true,          // dar de baja y reactivar (docs/spec-kpis.md §8)
  'empleados.gestionar': false,
  'indicadores.ver': false,       // panel de indicadores, solo admin (docs/spec-kpis.md §10)
}

export type AuthResult =
  | { user: StaffUser; error?: undefined }
  | { user?: undefined; error: string }

const NO_AUTORIZADO = 'No autorizado'

function isStaffRole(role: unknown): role is StaffRole {
  return role === 'admin' || role === 'employee'
}

export function hasPermission(role: StaffRole, permission: Permission): boolean {
  return role === 'admin' || EMPLOYEE_PERMISSIONS[permission]
}

export async function getStaffUser(): Promise<StaffUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const role = user.app_metadata?.role
  if (!isStaffRole(role)) return null

  return { id: user.id, email: user.email ?? null, role }
}

// Personal del centro (employee o admin).
export async function requireStaff(): Promise<AuthResult> {
  const user = await getStaffUser()
  if (!user) return { error: NO_AUTORIZADO }
  return { user }
}

// Personal con un permiso concreto.
export async function requirePermission(permission: Permission): Promise<AuthResult> {
  const user = await getStaffUser()
  if (!user || !hasPermission(user.role, permission)) return { error: NO_AUTORIZADO }
  return { user }
}
