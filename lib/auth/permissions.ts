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

// ---------------------------------------------------------------------------
// Clientes (vista /client)
//
// El cliente no lee tablas: solo las vistas mi_* (migración
// 20261106140000_vista_cliente_lectura.sql), que filtran por su cuenta. Para
// leerlas se usa el cliente de Supabase con su sesión (createClient), nunca
// createAdminClient(). En las Server Actions del cliente, el clientId sale
// SIEMPRE de requireClient(), nunca de los datos del formulario.

export type ClientUser = {
  id: string          // auth.users.id
  email: string | null
  clientId: string    // clients.id enlazado a la cuenta
}

export type ClientAuthResult =
  | { user: ClientUser; error?: undefined }
  | { user?: undefined; error: string }

export async function getClientUser(): Promise<ClientUser | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'client') return null

  // mi_ficha devuelve como mucho una fila: la ficha enlazada a esta cuenta.
  const { data: ficha } = await supabase.from('mi_ficha').select('id').maybeSingle()
  if (!ficha) return null

  return { id: user.id, email: user.email ?? null, clientId: ficha.id }
}

export async function requireClient(): Promise<ClientAuthResult> {
  const user = await getClientUser()
  if (!user) return { error: NO_AUTORIZADO }
  return { user }
}
