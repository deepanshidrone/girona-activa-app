import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Mail, MessageCircle, Phone, ShieldAlert } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffUser, hasPermission } from '@/lib/auth/permissions'
import { getCenterTimezone } from '@/lib/center-settings'
import { formatDateTimeEs } from '@/lib/center'
import { getLeadDetail } from '@/lib/leads/data'
import { leadFiltersQuery, parseLeadFilters } from '@/lib/leads/filters'
import { mailHref, telHref, whatsappHref } from '@/lib/leads/contact'
import { LeadBadges } from '../lead-badges'
import { DeleteLeadButton, MarkSeenOnOpen, NotesEditor, SpamButton } from './lead-actions'

// CRM fase 1: detalle de un lead (docs/spec-crm.md §8.3). Solo con leads.gestionar.
export const dynamic = 'force-dynamic'

const BASE = '/dashboard/crm/leads'
const card = 'bg-[#1C1C1C] rounded-2xl border border-white/10 p-5'

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const staff = await getStaffUser()
  if (!staff || !hasPermission(staff.role, 'leads.gestionar')) notFound()

  const { id } = await params
  const admin = createAdminClient()
  const [lead, timezone] = await Promise.all([getLeadDetail(admin, id), getCenterTimezone(admin)])
  if (!lead) notFound()

  // Volver al listado con los mismos filtros
  const backHref = BASE + leadFiltersQuery(parseLeadFilters(await searchParams))
  const tel = telHref(lead.phone_normalized)
  const wa = whatsappHref(lead.phone_normalized)
  const mail = mailHref(lead.email)
  const origin = lead.source === 'web' ? `Formulario web${lead.form_name ? ` · ${lead.form_name}` : ''}` : lead.source

  return (
    <div className="p-4 sm:p-6 pb-28 md:pb-6 flex flex-col gap-4 max-w-3xl">
      {!lead.seen_at && <MarkSeenOnOpen leadId={lead.id} />}

      <Link href={backHref} className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white w-fit">
        <ArrowLeft className="h-4 w-4" /> Leads
      </Link>

      {/* Cabecera */}
      <div className={card}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white">{lead.full_name}</h1>
            <p className="text-sm text-white/50 mt-1">
              {formatDateTimeEs(lead.received_at, timezone)} · {origin}
              {lead.channel_label && <> · {lead.channel_label}</>}
            </p>
          </div>
          <LeadBadges seen={!!lead.seen_at} duplicates={lead.duplicates} hasNotes={false} linkClient />
        </div>

        {lead.is_spam && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-amber-300">
            <ShieldAlert className="h-4 w-4" />
            Marcado como spam{lead.spam_marked_by_name ? ` por ${lead.spam_marked_by_name}` : ''}
            {lead.spam_marked_at ? ` el ${formatDateTimeEs(lead.spam_marked_at, timezone)}` : ''}. No sale en el listado ni en el contador.
          </p>
        )}

        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-white/40 text-xs">Teléfono</dt>
            <dd className="text-white">{lead.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-white/40 text-xs">Email</dt>
            <dd className="text-white break-all">{lead.email ?? '—'}</dd>
          </div>
        </dl>

        {/* Acciones de contacto: fijas abajo en el móvil */}
        {(tel || wa || mail) && (
          <div className="fixed md:static bottom-0 inset-x-0 z-20 md:z-auto p-3 md:p-0 md:mt-4 bg-[#1C1C1C] md:bg-transparent border-t md:border-0 border-white/10 flex gap-2">
            {tel && <ContactLink href={tel} icon={<Phone className="h-4 w-4" />} label="Llamar" />}
            {wa && <ContactLink href={wa} icon={<MessageCircle className="h-4 w-4" />} label="WhatsApp" external />}
            {mail && <ContactLink href={mail} icon={<Mail className="h-4 w-4" />} label="Email" />}
          </div>
        )}
      </div>

      {/* Respuestas del formulario */}
      <div className={card}>
        <h2 className="font-semibold text-white mb-3">Lo que ha escrito</h2>
        {lead.answers.length === 0 && !lead.message ? (
          <p className="text-sm text-white/40">El formulario no tenía más preguntas.</p>
        ) : (
          <dl className="flex flex-col gap-3">
            {lead.answers.map((a, i) => (
              <div key={`${a.key}-${i}`}>
                <dt className="text-xs text-white/40">{a.label}</dt>
                <dd className="text-sm text-white/85 whitespace-pre-line break-words">{a.value || '—'}</dd>
              </div>
            ))}
            {lead.message && (
              <div>
                <dt className="text-xs text-white/40">Mensaje</dt>
                <dd className="text-sm text-white/85 whitespace-pre-line break-words">{lead.message}</dd>
              </div>
            )}
          </dl>
        )}
      </div>

      {/* Otros envíos de la misma persona */}
      {lead.other_leads.length > 0 && (
        <div className={card}>
          <h2 className="font-semibold text-white mb-1">Otros envíos</h2>
          <p className="text-xs text-white/40 mb-3">Con el mismo email o teléfono.</p>
          <ul className="flex flex-col gap-1.5">
            {lead.other_leads.map(o => (
              <li key={o.id}>
                <Link href={`${BASE}/${o.id}`} className="text-sm text-white/75 hover:text-white hover:underline">
                  {formatDateTimeEs(o.received_at, timezone)} · {o.full_name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Nota interna */}
      <div className={card}>
        <h2 className="font-semibold text-white mb-3">Nota interna</h2>
        <NotesEditor
          leadId={lead.id}
          initial={lead.internal_notes ?? ''}
          footer={lead.notes_updated_at
            ? `Última edición: ${lead.notes_updated_by_name ?? '—'}, ${formatDateTimeEs(lead.notes_updated_at, timezone)}`
            : null}
        />
      </div>

      {/* Consentimiento (plegado) */}
      <details className={`${card} group`}>
        <summary className="cursor-pointer text-sm font-semibold text-white list-none flex items-center justify-between">
          Consentimiento
          <span className="text-xs font-normal text-white/40 group-open:hidden">Aceptado el {formatDateTimeEs(lead.consent_at, timezone)}</span>
        </summary>
        <div className="mt-3 text-sm flex flex-col gap-2">
          <p className="text-white/40 text-xs">Aceptado el {formatDateTimeEs(lead.consent_at, timezone)}</p>
          <p className="text-white/75 whitespace-pre-line">“{lead.consent_text}”</p>
          {lead.privacy_policy_url && (
            <a href={lead.privacy_policy_url} target="_blank" rel="noopener noreferrer"
              className="text-[var(--brand)] hover:underline break-all w-fit">
              Política de privacidad
            </a>
          )}
          {lead.page_url && <p className="text-white/35 text-xs break-all">Enviado desde {lead.page_url}</p>}
        </div>
      </details>

      {/* Más acciones */}
      <div className={`${card} flex items-center justify-between gap-4 flex-wrap`}>
        <SpamButton leadId={lead.id} isSpam={lead.is_spam} />
        <DeleteLeadButton leadId={lead.id} name={lead.full_name} backHref={backHref} />
      </div>

      {lead.seen_at && (
        <p className="text-xs text-white/30">
          Visto por {lead.seen_by_name ?? '—'} el {formatDateTimeEs(lead.seen_at, timezone)}
        </p>
      )}
    </div>
  )
}

function ContactLink({ href, icon, label, external = false }: { href: string; icon: React.ReactNode; label: string; external?: boolean }) {
  return (
    <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="flex-1 md:flex-none flex items-center justify-center gap-1.5 rounded-lg bg-[var(--brand)] hover:opacity-90 text-white text-sm font-semibold px-4 py-2.5 transition-opacity">
      {icon} {label}
    </a>
  )
}
