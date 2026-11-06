'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Target as TargetIcon, X } from 'lucide-react'
import { updateKpiTargetsAction } from '@/app/actions/kpis'
import type { Target } from '@/lib/kpis/compute'

// Panel lateral para editar los objetivos y umbrales (solo admin).
export function TargetsPanel({ targets }: { targets: Target[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(() =>
    Object.fromEntries(targets.map(t => [t.key, { min: t.value_min?.toString() ?? '', max: t.value_max?.toString() ?? '' }])),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function parse(v: string): number | null {
    const s = v.trim().replace(',', '.')
    return s === '' ? null : Number(s)
  }

  async function save() {
    setSaving(true)
    setError('')
    const result = await updateKpiTargetsAction(
      targets.map(t => ({
        key: t.key,
        // Solo se editan los extremos que el objetivo usa
        value_min: t.value_min !== null ? parse(values[t.key].min) : null,
        value_max: t.value_max !== null ? parse(values[t.key].max) : null,
      })),
    )
    setSaving(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setOpen(false)
    router.refresh()
  }

  const inputCls = 'w-20 rounded-lg bg-white text-[#1C1C1C] text-sm px-2 py-1.5 text-right'

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-sm text-white/70 hover:text-white hover:border-white/30 transition-colors">
        <TargetIcon className="h-4 w-4" />
        Objetivos
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => setOpen(false)}>
          <div className="h-full w-full max-w-md bg-[#1C1C1C] border-l border-white/10 p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-white">Objetivos y umbrales</h2>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-white/40 mb-5">
              Marcan el semáforo de cada indicador (ámbar a menos del 10 % del umbral) y cuándo salta cada alerta.
            </p>

            <div className="flex flex-col gap-4">
              {targets.map(t => (
                <div key={t.key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-white/80">{t.label}</span>
                  <span className="flex items-center gap-1.5 text-xs text-white/40 shrink-0">
                    {t.value_min !== null && (
                      <input aria-label={`${t.label}: mínimo`} inputMode="decimal" className={inputCls}
                        value={values[t.key].min}
                        onChange={e => setValues(v => ({ ...v, [t.key]: { ...v[t.key], min: e.target.value } }))} />
                    )}
                    {t.value_min !== null && t.value_max !== null && '–'}
                    {t.value_max !== null && (
                      <input aria-label={`${t.label}: máximo`} inputMode="decimal" className={inputCls}
                        value={values[t.key].max}
                        onChange={e => setValues(v => ({ ...v, [t.key]: { ...v[t.key], max: e.target.value } }))} />
                    )}
                    {t.unit}
                  </span>
                </div>
              ))}
            </div>

            {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

            <div className="flex gap-2 mt-6">
              <button onClick={save} disabled={saving}
                className="rounded-lg bg-[#FF914D] hover:bg-[#e07a3a] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-white/50 hover:text-white">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
