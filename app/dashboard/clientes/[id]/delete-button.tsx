'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteClientAction } from '@/app/actions/delete-client'

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    setLoading(true)
    const result = await deleteClientAction(clientId)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      setConfirming(false)
      return
    }
    router.push('/dashboard/clientes')
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-[#666666]">¿Eliminar a {clientName}?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-sm font-medium text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {loading ? 'Eliminando...' : 'Confirmar'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-sm font-medium text-[#666666] hover:text-[#1C1C1C] px-3 py-1.5 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
    >
      <Trash2 className="h-4 w-4" />
      Eliminar cliente
    </button>
  )
}
