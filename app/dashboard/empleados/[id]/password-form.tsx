'use client'

import { useState } from 'react'
import { changeEmployeePasswordAction } from '@/app/actions/employees'
import { Eye, EyeOff, KeyRound, Check } from 'lucide-react'

export function PasswordChangeForm({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Les contrasenyes no coincideixen.'); return }
    if (password.length < 8) { setError('Mínim 8 caràcters.'); return }

    setSaving(true)
    setError('')
    const result = await changeEmployeePasswordAction(employeeId, password)

    if (result.error) {
      setError(result.error)
    } else {
      setSaved(true)
      setPassword('')
      setConfirm('')
      setTimeout(() => setSaved(false), 4000)
    }
    setSaving(false)
  }

  const inputCls = 'w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#FF914D]/60'

  return (
    <form onSubmit={handleSubmit} className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5">
      <div className="flex items-center gap-2 mb-5">
        <KeyRound className="h-4 w-4 text-white/40" />
        <h2 className="font-semibold text-white">Canviar contrasenya</h2>
      </div>

      <p className="text-xs text-white/40 mb-4">
        Com a admin pots establir una nova contrasenya per a <span className="text-white/60 font-medium">{employeeName}</span> sense necessitar la contrasenya actual.
      </p>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wide">Nova contrasenya</label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={password}
              onChange={e => setPassword(e.target.value)} placeholder="Mínim 8 caràcters"
              className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowPw(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wide">Confirmar contrasenya</label>
          <input type={showPw ? 'text' : 'password'} value={confirm}
            onChange={e => setConfirm(e.target.value)} placeholder="Repeteix la contrasenya"
            className={`${inputCls} ${confirm && confirm !== password ? 'border-red-500/40' : ''}`} />
          {confirm && confirm !== password && (
            <p className="text-xs text-red-400">Les contrasenyes no coincideixen</p>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 text-red-400 text-sm bg-red-500/10 border border-red-500/20 px-4 py-2.5 rounded-xl">{error}</p>
      )}
      {saved && (
        <p className="mt-3 text-green-400 text-sm bg-green-500/10 border border-green-500/20 px-4 py-2.5 rounded-xl flex items-center gap-2">
          <Check className="h-4 w-4" />Contrasenya actualitzada correctament
        </p>
      )}

      <div className="mt-5 pt-4 border-t border-white/10">
        <button type="submit" disabled={saving || !password || password !== confirm}
          className="bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors">
          {saving ? 'Guardant...' : 'Actualitzar contrasenya'}
        </button>
      </div>
    </form>
  )
}
