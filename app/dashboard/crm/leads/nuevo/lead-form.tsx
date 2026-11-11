'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { createLeadAction } from '@/app/actions/leads'
import { MANUAL_CONSENT_TEXT, MANUAL_LIMITS, type CreateLeadState, type LeadFormCatalog } from '@/lib/leads/manual'
import { LEAD_STATUSES } from '@/lib/leads/status'

const card = 'bg-[#1C1C1C] rounded-2xl border border-white/10 p-5 flex flex-col gap-4'
const inputCls =
  'w-full rounded-lg bg-[#111111] border border-white/10 text-sm text-white px-3 py-2 placeholder:text-white/30 focus:outline-none focus:border-[var(--brand)]/60'
const labelCls = 'text-xs text-white/50 mb-1 block'

// Formulario de alta manual (docs/spec-crm.md §16.4). Los valores se guardan en
// el estado de la acción y vuelven como defaultValue, para no perder lo escrito
// cuando hay errores (React vacía el formulario tras cada envío).
export function LeadForm({ catalog, countryCode }: { catalog: LeadFormCatalog; countryCode: string }) {
  const [state, action, pending] = useActionState<CreateLeadState, FormData>(createLeadAction, {})
  const e = state.errors ?? {}
  const v = state.values ?? {}
  // Cada envío cambia la key: el formulario se vuelve a montar con los defaultValue
  const formKey = state.attempt ?? 0

  return (
    <form key={formKey} action={action} className="flex flex-col gap-4" noValidate>
      {e.form && <p className="text-sm text-red-400" role="alert">{e.form}</p>}

      <section className={card}>
        <h2 className="font-semibold text-white">Contacto</h2>
        <Field id="full_name" label="Nombre *" error={e.full_name}>
          <input id="full_name" name="full_name" required maxLength={MANUAL_LIMITS.name} autoComplete="off"
            defaultValue={v.full_name} className={inputCls} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="phone" label="Teléfono" error={e.phone} hint={`Sin prefijo se entiende +${countryCode}`}>
            <input id="phone" name="phone" type="tel" inputMode="tel" maxLength={MANUAL_LIMITS.phone} autoComplete="off"
              defaultValue={v.phone} className={inputCls} />
          </Field>
          <Field id="email" label="Email" error={e.email}>
            <input id="email" name="email" type="email" maxLength={MANUAL_LIMITS.email} autoComplete="off"
              defaultValue={v.email} className={inputCls} />
          </Field>
        </div>
        <p className="text-xs text-white/35 -mt-2">Hace falta al menos el teléfono o el email.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {catalog.channels.length > 0 && (
            <Field id="channel_key" label="Cómo nos ha conocido" error={e.channel_key}>
              <select id="channel_key" name="channel_key" defaultValue={v.channel_key ?? ''} className={inputCls}>
                <option value="">Sin indicar</option>
                {catalog.channels.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
          )}
          <Field id="status" label="Estado" error={e.status}>
            <select id="status" name="status" defaultValue={v.status ?? 'nuevo'} className={inputCls}>
              {LEAD_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </Field>
        </div>
      </section>

      {catalog.questions.length > 0 && (
        <section className={card}>
          <div>
            <h2 className="font-semibold text-white">Preguntas del formulario de la web</h2>
            <p className="text-xs text-white/40 mt-0.5">Todas opcionales.</p>
          </div>
          {catalog.questions.map(q => {
            const id = `answer-${q.key}`
            const name = `answer:${q.key}`
            const dv = v.answers?.[q.key]
            return (
              <Field key={q.key} id={id} label={q.label} error={e.answers?.[q.key]}>
                {q.long ? (
                  <textarea id={id} name={name} rows={3} maxLength={MANUAL_LIMITS.answer} defaultValue={dv} className={inputCls} />
                ) : (
                  <>
                    <input id={id} name={name} maxLength={MANUAL_LIMITS.answer} autoComplete="off" defaultValue={dv}
                      list={q.suggestions.length ? `${id}-list` : undefined} className={inputCls} />
                    {q.suggestions.length > 0 && (
                      <datalist id={`${id}-list`}>
                        {q.suggestions.map(s => <option key={s} value={s} />)}
                      </datalist>
                    )}
                  </>
                )}
              </Field>
            )
          })}
        </section>
      )}

      <section className={card}>
        <Field id="notes" label="Comentario (va a la nota interna)" error={e.notes}>
          <textarea id="notes" name="notes" rows={3} maxLength={MANUAL_LIMITS.notes} defaultValue={v.notes}
            placeholder="Por ejemplo: «Viene por dolor de espalda, prefiere tardes»." className={inputCls} />
        </Field>

        <div>
          <label className="flex items-start gap-2 text-sm text-white/80 cursor-pointer">
            <input type="checkbox" name="consent" defaultChecked={v.consent} className="mt-0.5 accent-[var(--brand)]" />
            <span>
              {MANUAL_CONSENT_TEXT} *
              {catalog.policyUrl && (
                <> <a href={catalog.policyUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--brand)] hover:underline">Ver la política</a></>
              )}
            </span>
          </label>
          {e.consent && <p className="text-xs text-red-400 mt-1">{e.consent}</p>}
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Link href="/dashboard/crm/leads" className="text-sm text-white/60 hover:text-white px-3 py-2">Cancelar</Link>
        <button type="submit" disabled={pending}
          className="text-sm font-semibold text-white bg-[var(--brand)] hover:opacity-90 px-5 py-2 rounded-lg transition-opacity disabled:opacity-50">
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      {children}
      {error ? <p className="text-xs text-red-400 mt-1">{error}</p> : hint && <p className="text-xs text-white/35 mt-1">{hint}</p>}
    </div>
  )
}
