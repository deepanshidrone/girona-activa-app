'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateEmployeeAction, toggleEmployeeActiveAction, type Employee } from '@/app/actions/employees'
import { X, Plus, Check } from 'lucide-react'

const SPECIALTIES_SUGGESTIONS = [
  'Força', 'Cardio', 'Mobilitat', 'Rehabilitació', 'Pilates',
  'Nutrició', 'CrossFit', 'Ioga', 'Funcional', 'Esports',
]

export function EmployeeEditForm({ employee }: { employee: Employee }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [togglingActive, setTogglingActive] = useState(false)

  const [form, setForm] = useState({
    full_name: employee.full_name,
    phone: employee.phone ?? '',
    hire_date: employee.hire_date ?? '',
    role: employee.role,
  })
  const [specialties, setSpecialties] = useState<string[]>(employee.specialties ?? [])
  const [specialtyInput, setSpecialtyInput] = useState('')

  function addSpecialty(value: string) {
    const trimmed = value.trim()
    if (trimmed && !specialties.includes(trimmed)) setSpecialties(prev => [...prev, trimmed])
    setSpecialtyInput('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    const result = await updateEmployeeAction(employee.id, {
      full_name: form.full_name,
      phone: form.phone,
      hire_date: form.hire_date,
      role: form.role,
      specialties,
    })

    if (result.error) {
      setError(result.error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      router.refresh()
    }
    setSaving(false)
  }

  async function handleToggleActive() {
    setTogglingActive(true)
    await toggleEmployeeActiveAction(employee.id, !employee.is_active)
    setTogglingActive(false)
    router.refresh()
  }

  const inputCls = 'w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF914D]/60'
  const labelCls = 'text-xs font-semibold text-white/40 uppercase tracking-wide'

  return (
    <form onSubmit={handleSave} className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5">
      <h2 className="font-semibold text-white mb-5">Editar dades</h2>

      <div className="flex flex-col gap-4">
        {/* Nom i telèfon */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Nom complet</label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              required className={inputCls} placeholder="Nom complet" />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Telèfon</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className={inputCls} placeholder="+34 600 000 000" />
          </div>
        </div>

        {/* Data incorporació i rol */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Data d&apos;incorporació</label>
            <input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))}
              className={inputCls} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Rol</label>
            <div className="flex gap-2">
              {(['employee', 'admin'] as const).map(r => (
                <button key={r} type="button" onClick={() => setForm(f => ({ ...f, role: r }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${form.role === r ? 'bg-[#FF914D]/15 border-[#FF914D]/40 text-[#FF914D]' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
                  {r === 'admin' ? 'Admin' : 'Empleat'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Especialitats */}
        <div className="flex flex-col gap-2">
          <label className={labelCls}>Especialitats</label>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {specialties.map(s => (
              <span key={s} className="flex items-center gap-1 px-2.5 py-1 bg-[#FF914D]/10 text-[#FF914D] text-xs rounded-lg border border-[#FF914D]/20">
                {s}
                <button type="button" onClick={() => setSpecialties(prev => prev.filter(x => x !== s))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={specialtyInput} onChange={e => setSpecialtyInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(specialtyInput) } }}
              placeholder="Afegir especialitat..." className={`${inputCls} flex-1`} />
            <button type="button" onClick={() => addSpecialty(specialtyInput)}
              className="px-3 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {SPECIALTIES_SUGGESTIONS.filter(s => !specialties.includes(s)).map(s => (
              <button key={s} type="button" onClick={() => addSpecialty(s)}
                className="px-2 py-0.5 text-[11px] text-white/25 border border-white/10 rounded-lg hover:text-white/50 hover:border-white/20 transition-colors">
                + {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">{error}</p>
      )}

      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/10">
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 bg-[#FF914D] hover:bg-[#e07a3a] disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          {saved ? <><Check className="h-4 w-4" />Guardat</> : saving ? 'Guardant...' : 'Guardar canvis'}
        </button>
        <button type="button" onClick={handleToggleActive} disabled={togglingActive}
          className={`ml-auto text-sm font-medium px-4 py-2.5 rounded-xl border transition-colors ${
            employee.is_active
              ? 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
              : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
          }`}>
          {togglingActive ? '...' : employee.is_active ? 'Desactivar compte' : 'Activar compte'}
        </button>
      </div>
    </form>
  )
}
