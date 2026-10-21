'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEmployeeAction } from '@/app/actions/employees'
import { ArrowLeft, UserPlus, X, Plus } from 'lucide-react'
import Link from 'next/link'

const SPECIALTIES_SUGGESTIONS = [
  'Força', 'Cardio', 'Mobilitat', 'Rehabilitació', 'Pilates',
  'Nutrició', 'CrossFit', 'Ioga', 'Funcional', 'Esports',
]

export default function NouEmpleatPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    role: 'employee' as 'employee' | 'admin',
    phone: '',
    hire_date: '',
  })
  const [specialties, setSpecialties] = useState<string[]>([])
  const [specialtyInput, setSpecialtyInput] = useState('')

  function addSpecialty(value: string) {
    const trimmed = value.trim()
    if (trimmed && !specialties.includes(trimmed)) {
      setSpecialties(prev => [...prev, trimmed])
    }
    setSpecialtyInput('')
  }

  function removeSpecialty(s: string) {
    setSpecialties(prev => prev.filter(x => x !== s))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await createEmployeeAction({
      full_name: form.full_name,
      email: form.email,
      role: form.role,
      phone: form.phone || undefined,
      hire_date: form.hire_date || undefined,
      specialties,
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
    setTimeout(() => router.push('/dashboard/empleados'), 2000)
  }

  if (success) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="h-8 w-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Empleat creat correctament</h2>
          <p className="text-white/50 text-sm">S&apos;ha enviat un email d&apos;invitació per establir la contrasenya.</p>
          <p className="text-white/30 text-xs mt-2">Redirigint...</p>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF914D]/60'
  const labelCls = 'text-xs font-semibold text-white/50 uppercase tracking-wide'

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/empleados" className="text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Nou empleat</h1>
          <p className="text-white/50 text-sm mt-0.5">Crea un compte i envia l&apos;invitació per email</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-6 flex flex-col gap-5">

        {/* Nom i email */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Nom complet <span className="text-red-400">*</span></label>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Maria García" required className={inputCls} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Email <span className="text-red-400">*</span></label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="maria@gironaactiva.com" required className={inputCls} />
          </div>
        </div>

        {/* Rol */}
        <div className="flex flex-col gap-2">
          <label className={labelCls}>Rol <span className="text-red-400">*</span></label>
          <div className="flex gap-2">
            {(['employee', 'admin'] as const).map(r => (
              <button key={r} type="button" onClick={() => setForm(f => ({ ...f, role: r }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${form.role === r ? 'bg-[#FF914D]/15 border-[#FF914D]/40 text-[#FF914D]' : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'}`}>
                {r === 'admin' ? 'Admin' : 'Empleat'}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-white/30">
            {form.role === 'admin' ? 'Accés complet: gestió d\'empleats, contraseyes i configuració.' : 'Accés estàndard al dashboard (sessions, clients, planes).'}
          </p>
        </div>

        {/* Telèfon i data incorporació */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Telèfon</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+34 600 000 000" className={inputCls} />
          </div>
          <div className="flex flex-col gap-2">
            <label className={labelCls}>Data d&apos;incorporació</label>
            <input type="date" value={form.hire_date} onChange={e => setForm(f => ({ ...f, hire_date: e.target.value }))}
              className={inputCls} />
          </div>
        </div>

        {/* Especialitats */}
        <div className="flex flex-col gap-2">
          <label className={labelCls}>Especialitats</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {specialties.map(s => (
              <span key={s} className="flex items-center gap-1 px-2.5 py-1 bg-[#FF914D]/10 text-[#FF914D] text-xs rounded-lg border border-[#FF914D]/20">
                {s}
                <button type="button" onClick={() => removeSpecialty(s)}><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={specialtyInput} onChange={e => setSpecialtyInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(specialtyInput) } }}
              placeholder="Escriu i prem Enter..." className={`${inputCls} flex-1`} />
            <button type="button" onClick={() => addSpecialty(specialtyInput)}
              className="px-3 py-2 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {SPECIALTIES_SUGGESTIONS.filter(s => !specialties.includes(s)).map(s => (
              <button key={s} type="button" onClick={() => addSpecialty(s)}
                className="px-2 py-0.5 text-[11px] text-white/30 border border-white/10 rounded-lg hover:text-white/60 hover:border-white/20 transition-colors">
                + {s}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading}
            className="flex-1 bg-[#FF914D] hover:bg-[#e07a3a] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            {loading ? 'Creant empleat...' : 'Crear i enviar invitació'}
          </button>
          <Link href="/dashboard/empleados"
            className="px-4 py-2.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm font-medium transition-colors">
            Cancel·lar
          </Link>
        </div>
      </form>
    </div>
  )
}
