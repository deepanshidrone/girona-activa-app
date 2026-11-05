'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Smartphone, Send, CheckCircle2, Clock } from 'lucide-react'
import { inviteClientAction } from '@/app/actions/clients'
import { Input } from '@/components/ui/input'

export type AccessStatus = 'none' | 'invited' | 'active'

type Props = {
  clientId: string
  email: string | null
  status: AccessStatus
  invitedAt: string | null
  lastSignInAt: string | null
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AccessCard({ clientId, email, status, invitedAt, lastSignInAt }: Props) {
  const router = useRouter()
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleInvite() {
    setLoading(true)
    setError('')
    const result = await inviteClientAction(clientId, email ? undefined : newEmail)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSent(true)
    router.refresh()
  }

  return (
    <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Smartphone className="h-4 w-4 text-white/40" />
        <h2 className="font-semibold text-white">Acceso a la app</h2>
      </div>

      {status === 'active' && (
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-white">Activo</p>
            <p className="text-xs text-white/40">
              {email}{lastSignInAt ? ` · último acceso ${formatDate(lastSignInAt)}` : ''}
            </p>
          </div>
        </div>
      )}

      {status === 'invited' && (
        <div className="flex items-start gap-2 mb-3">
          <Clock className="h-4 w-4 text-[#FF914D] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-white">Invitado, todavía no ha entrado</p>
            <p className="text-xs text-white/40">
              {email}{invitedAt ? ` · invitación del ${formatDate(invitedAt)}` : ''}
            </p>
          </div>
        </div>
      )}

      {status === 'none' && (
        <p className="text-sm text-white/40 mb-3">
          Sin acceso. El cliente no necesita la app para tener planes; invítale solo si la va a usar.
        </p>
      )}

      {status !== 'active' && (
        <div className="flex flex-col gap-2">
          {!email && (
            <Input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="email del cliente"
            />
          )}
          <button
            onClick={handleInvite}
            disabled={loading || (!email && !newEmail)}
            className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-[#FF914D] hover:bg-[#e07a3a] px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {loading
              ? 'Enviando...'
              : status === 'invited'
                ? 'Reenviar invitación'
                : email ? 'Enviar invitación' : 'Guardar email e invitar'}
          </button>
          {sent && !error && (
            <p className="text-xs text-green-400">Invitación enviada. El enlace es válido 24 horas.</p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
