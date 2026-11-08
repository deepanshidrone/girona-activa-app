import { getPortal } from '@/lib/client-portal/data'

// Pendiente: datos de la ficha y cambio de contraseña en la segunda entrega
// (docs/spec-vista-cliente.md §4.1.6). De momento, solo cerrar sesión.
export default async function ClientProfilePage() {
  const portal = await getPortal()
  if (!portal?.ficha) return null
  const { ficha, email } = portal

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Perfil</h1>
      <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4">
        <p className="font-semibold">{ficha.first_name} {ficha.last_name}</p>
        <p className="text-sm text-white/50">{ficha.email ?? email}</p>
      </div>
      <a
        href="/logout"
        className="block text-center rounded-xl border border-white/10 bg-[#1C1C1C] py-3 text-sm font-medium text-white/80 active:bg-white/5"
      >
        Cerrar sesión
      </a>
    </div>
  )
}
