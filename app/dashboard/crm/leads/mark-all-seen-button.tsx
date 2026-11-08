'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCheck } from 'lucide-react'
import { markAllLeadsSeenAction } from '@/app/actions/leads'

export function MarkAllSeenButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setLoading(true)
    setError('')
    const r = await markAllLeadsSeenAction()
    setLoading(false)
    if (!r.ok) return setError(r.error)
    router.refresh()
  }

  return (
    <div className="flex flex-col items-end">
      <button onClick={run} disabled={loading}
        className="flex items-center gap-1.5 text-sm font-medium text-white/60 hover:text-white bg-[#1C1C1C] border border-white/10 rounded-lg px-3 py-2 transition-colors disabled:opacity-50">
        <CheckCheck className="h-4 w-4" />
        {loading ? 'Marcando…' : 'Marcar todos como vistos'}
      </button>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  )
}
