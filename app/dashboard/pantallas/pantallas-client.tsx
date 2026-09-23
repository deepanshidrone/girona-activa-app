'use client'

import { useState, useTransition } from 'react'
import { Monitor, MonitorOff, Play, Square, Copy, Check, User, Users } from 'lucide-react'
import { createScreenAssignmentAction, endScreenAssignmentAction } from '@/app/actions/screens'

type Client = { id: string; full_name: string }
type PlanSession = { id: string; session_date: string; plan_name: string }
type Screen = {
  id: string
  name: string
  location: string | null
  access_token: string
  activeAssignment: {
    id: string
    session_type: 'individual' | 'group'
    client_name: string | null
    session_date: string | null
  } | null
}

type Props = {
  screens: Screen[]
  clients: Client[]
  todaySessions: { clientId: string; sessions: PlanSession[] }[]
  baseUrl: string
}

export default function PantallasClient({ screens: initialScreens, clients, todaySessions, baseUrl }: Props) {
  const [screens, setScreens] = useState(initialScreens)
  const [isPending, startTransition] = useTransition()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Check-in modal state
  const [checkInScreen, setCheckInScreen] = useState<Screen | null>(null)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState('')

  const clientSessions = selectedClientId
    ? (todaySessions.find(t => t.clientId === selectedClientId)?.sessions ?? [])
    : []

  function copyUrl(screen: Screen) {
    const url = `${baseUrl}/pantalla/${screen.id}?token=${screen.access_token}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(screen.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function openCheckIn(screen: Screen) {
    setCheckInScreen(screen)
    setSelectedClientId('')
    setSelectedSessionId('')
  }

  function handleEndSession(screenId: string) {
    startTransition(async () => {
      const result = await endScreenAssignmentAction(screenId)
      if (result.success) {
        setScreens(prev => prev.map(s =>
          s.id === screenId ? { ...s, activeAssignment: null } : s
        ))
      }
    })
  }

  function handleCheckIn() {
    if (!checkInScreen || !selectedClientId || !selectedSessionId) return
    startTransition(async () => {
      const result = await createScreenAssignmentAction({
        screen_id: checkInScreen.id,
        session_type: 'individual',
        client_id: selectedClientId,
        plan_session_id: selectedSessionId,
      })
      if (result.success) {
        const client = clients.find(c => c.id === selectedClientId)
        const session = clientSessions.find(s => s.id === selectedSessionId)
        setScreens(prev => prev.map(s =>
          s.id === checkInScreen.id
            ? {
                ...s,
                activeAssignment: {
                  id: 'new',
                  session_type: 'individual',
                  client_name: client?.full_name ?? null,
                  session_date: session?.session_date ?? null,
                },
              }
            : s
        ))
        setCheckInScreen(null)
      }
    })
  }

  return (
    <>
      {/* Screen grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {screens.map(screen => {
          const isActive = !!screen.activeAssignment
          return (
            <div key={screen.id} className="bg-[#1C1C1C] rounded-2xl border border-white/10 overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-[#FF914D]/15' : 'bg-white/5'}`}>
                    {isActive
                      ? <Monitor className="w-4 h-4 text-[#FF914D]" />
                      : <MonitorOff className="w-4 h-4 text-white/30" />
                    }
                  </div>
                  <div>
                    <div className="text-white font-semibold text-sm">{screen.name}</div>
                    {screen.location && <div className="text-white/40 text-xs">{screen.location}</div>}
                  </div>
                </div>
                <div className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  isActive
                    ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                    : 'bg-white/5 text-white/30 border border-white/10'
                }`}>
                  {isActive ? 'Activa' : 'Lliure'}
                </div>
              </div>

              {/* Active session info */}
              <div className="px-5 py-4">
                {isActive && screen.activeAssignment ? (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-full bg-[#FF914D]/15 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-[#FF914D]" />
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">{screen.activeAssignment.client_name ?? 'Sessió activa'}</div>
                      {screen.activeAssignment.session_date && (
                        <div className="text-white/40 text-xs">
                          {new Date(screen.activeAssignment.session_date + 'T12:00:00').toLocaleDateString('ca-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-white/25 text-sm mb-4">Cap sessió activa</div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {isActive ? (
                    <button
                      onClick={() => handleEndSession(screen.id)}
                      disabled={isPending}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Finalitzar sessió
                    </button>
                  ) : (
                    <button
                      onClick={() => openCheckIn(screen)}
                      disabled={isPending}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#FF914D] text-white hover:bg-[#e07a3a] transition-colors disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      Check-in
                    </button>
                  )}

                  <button
                    onClick={() => copyUrl(screen)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70 transition-colors"
                    title="Copiar URL de la pantalla"
                  >
                    {copiedId === screen.id
                      ? <><Check className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copiat</span></>
                      : <><Copy className="w-3.5 h-3.5" />URL</>
                    }
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Check-in modal */}
      {checkInScreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-[#FF914D]/15 flex items-center justify-center">
                <Monitor className="w-4.5 h-4.5 text-[#FF914D]" />
              </div>
              <div>
                <div className="text-white font-semibold">Check-in — {checkInScreen.name}</div>
                {checkInScreen.location && <div className="text-white/40 text-xs">{checkInScreen.location}</div>}
              </div>
            </div>

            {/* Session type: individual only for now */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2 text-white/50 text-xs font-medium uppercase tracking-widest">
                <User className="w-3.5 h-3.5" />
                Tipus de sessió
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#FF914D]/10 border border-[#FF914D]/30 text-[#FF914D] text-sm font-medium cursor-default">
                  <User className="w-4 h-4" />
                  Individual
                </div>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/25 text-sm cursor-not-allowed" title="Disponible aviat">
                  <Users className="w-4 h-4" />
                  Grupal
                </div>
              </div>
            </div>

            {/* Client selector */}
            <div className="mb-4">
              <label className="block text-white/50 text-xs font-medium uppercase tracking-widest mb-2">Client</label>
              <select
                value={selectedClientId}
                onChange={e => { setSelectedClientId(e.target.value); setSelectedSessionId('') }}
                className="w-full bg-[#111111] border border-white/10 rounded-xl text-white text-sm px-3 py-2.5 focus:outline-none focus:border-[#FF914D]/50"
              >
                <option value="">Seleccionar client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.full_name}</option>
                ))}
              </select>
            </div>

            {/* Session selector */}
            {selectedClientId && (
              <div className="mb-6">
                <label className="block text-white/50 text-xs font-medium uppercase tracking-widest mb-2">Sessió</label>
                {clientSessions.length === 0 ? (
                  <div className="text-white/30 text-sm px-3 py-2.5 bg-[#111111] border border-white/10 rounded-xl">
                    Cap sessió per avui
                  </div>
                ) : (
                  <select
                    value={selectedSessionId}
                    onChange={e => setSelectedSessionId(e.target.value)}
                    className="w-full bg-[#111111] border border-white/10 rounded-xl text-white text-sm px-3 py-2.5 focus:outline-none focus:border-[#FF914D]/50"
                  >
                    <option value="">Seleccionar sessió...</option>
                    {clientSessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.plan_name} — {new Date(s.session_date + 'T12:00:00').toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setCheckInScreen(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white/50 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              >
                Cancel·lar
              </button>
              <button
                onClick={handleCheckIn}
                disabled={!selectedClientId || !selectedSessionId || isPending}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-[#FF914D] hover:bg-[#e07a3a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Iniciar sessió
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
