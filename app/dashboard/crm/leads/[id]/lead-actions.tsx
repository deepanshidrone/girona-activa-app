'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react'
import { deleteLeadAction, markLeadSeenAction, saveLeadNotesAction, setLeadSpamAction, setLeadStatusAction } from '@/app/actions/leads'
import { LEAD_STATUSES, leadStatusInfo } from '@/lib/leads/status'

// Marca el lead como visto al abrir el detalle (docs/spec-crm.md D5). Se hace
// desde el navegador y no al pintar la página en el servidor, para que una
// precarga del enlace no lo marque sin que nadie lo haya abierto.
export function MarkSeenOnOpen({ leadId }: { leadId: string }) {
  const router = useRouter()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    markLeadSeenAction(leadId).then(r => { if (r.ok) router.refresh() })
  }, [leadId, router])
  return null
}

export function NotesEditor({ leadId, initial, footer }: { leadId: string; initial: string; footer: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const dirty = value.trim() !== initial.trim()

  async function save() {
    setSaving(true)
    setMsg(null)
    const r = await saveLeadNotesAction(leadId, value)
    setSaving(false)
    if (!r.ok) return setMsg({ ok: false, text: r.error })
    setMsg({ ok: true, text: 'Guardado' })
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="lead-notes" className="sr-only">Nota interna</label>
      <textarea id="lead-notes" value={value} onChange={e => { setValue(e.target.value); setMsg(null) }}
        rows={4} maxLength={5000} placeholder="Solo la ve el personal del centro. Por ejemplo: «Llamar por la tarde»."
        className="w-full rounded-xl bg-[#111111] border border-white/10 text-sm text-white p-3 placeholder:text-white/30 focus:outline-none focus:border-[var(--brand)]/60" />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-xs text-white/35">{footer}</span>
        <div className="flex items-center gap-3">
          {msg && <span className={`text-xs ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</span>}
          <button onClick={save} disabled={!dirty || saving}
            className="text-sm font-semibold text-white bg-[var(--brand)] hover:opacity-90 px-4 py-1.5 rounded-lg transition-opacity disabled:opacity-40">
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SpamButton({ leadId, isSpam }: { leadId: string; isSpam: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    setLoading(true)
    setError('')
    const r = await setLeadSpamAction(leadId, !isSpam)
    setLoading(false)
    if (!r.ok) return setError(r.error)
    router.refresh()
  }

  return (
    <div>
      <button onClick={toggle} disabled={loading}
        className="flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white transition-colors disabled:opacity-50">
        {isSpam ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
        {loading ? 'Guardando…' : isSpam ? 'No es spam' : 'Marcar como spam'}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}

export function DeleteLeadButton({ leadId, name, backHref }: { leadId: string; name: string; backHref: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    setLoading(true)
    const r = await deleteLeadAction(leadId)
    if (!r.ok) {
      setLoading(false)
      setConfirming(false)
      return setError(r.error)
    }
    router.push(backHref)
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-white/60">¿Borrar el lead de {name}? No se puede deshacer.</span>
        <button onClick={remove} disabled={loading}
          className="text-sm font-medium text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
          {loading ? 'Borrando…' : 'Borrar'}
        </button>
        <button onClick={() => setConfirming(false)} className="text-sm font-medium text-white/40 hover:text-white px-3 py-1.5">
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => setConfirming(true)}
        className="flex items-center gap-1.5 text-sm font-medium text-red-400 hover:text-red-300 transition-colors">
        <Trash2 className="h-4 w-4" /> Borrar lead
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}

// Estado comercial (docs/spec-crm.md §17): se guarda al cambiarlo.
export function StatusSelect({ leadId, status, footer }: { leadId: string; status: string; footer: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(status)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function change(next: string) {
    const prev = value
    setValue(next)
    setSaving(true)
    setError(null)
    const r = await setLeadStatusAction(leadId, next)
    setSaving(false)
    if (!r.ok) { setValue(prev); return setError(r.error) }
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="lead-status" className="text-xs text-white/40">Estado</label>
      <select id="lead-status" value={value} disabled={saving} onChange={e => change(e.target.value)}
        className={`rounded-lg border border-white/10 text-sm font-semibold px-3 py-2 focus:outline-none focus:border-[var(--brand)]/60 disabled:opacity-60 bg-[#111111] ${leadStatusInfo(value).cls}`}>
        {LEAD_STATUSES.map(s => <option key={s.key} value={s.key} className="bg-[#1C1C1C] text-white">{s.label}</option>)}
      </select>
      {error ? <span className="text-xs text-red-400">{error}</span> : footer && <span className="text-xs text-white/35">{footer}</span>}
    </div>
  )
}
