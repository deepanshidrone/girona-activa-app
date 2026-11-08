import { getPortal } from '@/lib/client-portal/data'
import { formatDateEs } from '@/lib/center'
import { formatKg } from '@/lib/client-portal/types'
import { PasswordForm } from './password-form'

export const dynamic = 'force-dynamic'

// Perfil: datos de la ficha en solo lectura (derecho de acceso del RGPD),
// cambio de contraseña y cerrar sesión. docs/spec-vista-cliente.md §4.1.6
export default async function ClientProfilePage() {
  const portal = await getPortal()
  if (!portal?.ficha) return null
  const { ficha, email } = portal
  const loginEmail = email ?? ficha.email

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Perfil</h1>

      <section className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4">
        <p className="font-semibold text-lg">{ficha.first_name} {ficha.last_name}</p>
        {loginEmail && <p className="text-sm text-white/50">{loginEmail}</p>}
        <dl className="mt-4 flex flex-col gap-2.5">
          <Row label="Socio/a desde" value={formatDateEs(ficha.start_date, { month: 'long', year: 'numeric' })} />
          <Row label="Fecha de nacimiento" value={formatDateEs(ficha.birth_date)} />
          <Row label="Altura" value={ficha.height_cm ? `${ficha.height_cm} cm` : '—'} />
          <Row label="Peso" value={ficha.weight_kg ? `${formatKg(ficha.weight_kg)} kg` : '—'} />
        </dl>
        <p className="text-xs text-white/40 mt-4">Si algún dato no es correcto, díselo a tu centro.</p>
      </section>

      {loginEmail && <PasswordForm email={loginEmail} />}

      <a
        href="/logout"
        className="block text-center rounded-xl border border-white/10 bg-[#1C1C1C] py-3 text-sm font-medium text-white/80 active:bg-white/5"
      >
        Cerrar sesión
      </a>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <dt className="text-white/45">{label}</dt>
      <dd className="text-white/85 text-right">{value}</dd>
    </div>
  )
}
