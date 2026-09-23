'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

type Exercise = {
  id: string
  name: string
  sets: number
  reps: number
  weight_kg: number | null
  notes: string | null
  order_index: number
  block_label: string | null
}

type SessionData = {
  type: 'individual'
  clientName: string
  sessionDate: string
  employeeName: string
  planName: string
  exercises: Exercise[]
} | {
  type: 'group'
  groupName: string
  sessionDate: string
  employeeName: string
  columns: {
    label: string
    color: 'yellow' | 'red' | 'green'
    blocks: { title: string; exercises: { name: string; sets: number; reps: number; weight_kg: number | null }[] }[]
  }[]
} | null

type Props = {
  screenId: string
  initialData: SessionData
}

function Logo() {
  return (
    <div className="fixed bottom-7 right-8 flex items-center gap-3 opacity-50 z-50">
      <Image src="/logo.png" alt="Girona Activa" width={36} height={36} className="rounded-full object-cover ring-1 ring-white/20" />
      <div className="flex flex-col">
        <span className="text-white text-sm font-black tracking-widest uppercase leading-tight" style={{ fontStyle: 'italic' }}>
          GIRONA <span className="text-[#FF914D]">ACTIVA</span>
        </span>
        <span className="text-white/40 text-[9px] tracking-widest uppercase">Centre d&apos;Entrenament</span>
      </div>
    </div>
  )
}

function IdleState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6" style={{ background: '#080C0A' }}>
      <div className="opacity-20 flex flex-col items-center gap-5">
        <Image src="/logo.png" alt="Girona Activa" width={100} height={100} className="rounded-full object-cover" />
        <div className="text-white font-black tracking-[0.3em] uppercase text-3xl" style={{ fontStyle: 'italic' }}>
          GIRONA <span style={{ color: '#FF914D' }}>ACTIVA</span>
        </div>
        <div className="text-white/40 text-sm tracking-[0.2em] uppercase">Centre d&apos;Entrenament</div>
      </div>
      <Logo />
    </div>
  )
}

// Derive block label from order_index if not stored: A, B, C...
// Block breaks happen when exercises share a consecutive letter group
function groupByBlock(exercises: Exercise[]) {
  const blocks: { label: string; rows: Exercise[] }[] = []
  for (const ex of exercises) {
    const label = ex.block_label ?? String.fromCharCode(65 + Math.floor(ex.order_index / 2))
    const last = blocks[blocks.length - 1]
    if (last && last.label === label) {
      last.rows.push(ex)
    } else {
      blocks.push({ label, rows: [ex] })
    }
  }
  return blocks
}

function formatLoad(ex: { weight_kg: number | null; notes: string | null; reps: number }) {
  if (ex.notes) return ex.notes
  if (ex.weight_kg) return `${ex.weight_kg} kg`
  return '—'
}

function IndividualView({ data }: { data: Extract<SessionData, { type: 'individual' }> }) {
  const blocks = groupByBlock(data.exercises)

  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: '#080C0A', padding: '48px 56px 80px' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <div className="text-xs font-semibold tracking-[0.16em] uppercase mb-2" style={{ color: '#FF914D' }}>
            ▸ Sessió en curs
          </div>
          <div className="font-black tracking-wide leading-none mb-3" style={{ fontSize: '3.2vw', color: '#F2F2F0', fontStyle: 'italic' }}>
            {data.clientName}
          </div>
          <div className="flex items-center gap-4 text-sm" style={{ color: 'rgba(242,242,240,0.4)' }}>
            <span>{data.planName}</span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
            <span>{new Date(data.sessionDate + 'T12:00:00').toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
            <span>{data.employeeName}</span>
          </div>
        </div>
        <div className="text-right text-sm" style={{ color: 'rgba(242,242,240,0.35)' }}>
          <div className="font-semibold" style={{ color: 'rgba(242,242,240,0.7)' }}>Part Principal</div>
          <div>{data.exercises.length} exercicis</div>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid mb-3 px-5 text-xs font-semibold tracking-[0.14em] uppercase" style={{
        gridTemplateColumns: '64px 1fr 110px 110px 160px',
        color: 'rgba(242,242,240,0.28)'
      }}>
        <div></div>
        <div>Exercici</div>
        <div className="text-right">Sèries</div>
        <div className="text-right">Reps</div>
        <div className="text-right">Càrrega</div>
      </div>

      {/* Exercise blocks */}
      <div className="flex flex-col gap-2 overflow-auto">
        {blocks.map((block, bi) => (
          <div key={bi} className="rounded-lg overflow-hidden">
            {block.rows.map((ex, ri) => (
              <div key={ex.id} className="grid items-center px-5"
                style={{
                  gridTemplateColumns: '64px 1fr 110px 110px 160px',
                  background: ri % 2 === 1 ? '#1A201A' : '#111611',
                  borderBottom: ri < block.rows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  padding: '18px 20px',
                }}
              >
                <div className="font-black tracking-wide" style={{ fontSize: '1.4vw', color: '#FF914D' }}>
                  {block.rows.length > 1 ? `${block.label}${ri + 1}` : block.label}
                </div>
                <div className="pr-6 font-normal" style={{ fontSize: '1.35vw', color: '#F2F2F0' }}>
                  {ex.name}
                </div>
                <div className="text-right font-semibold tabular-nums" style={{ fontSize: '1.35vw', color: '#F2F2F0' }}>
                  {ex.sets}
                </div>
                <div className="text-right font-semibold tabular-nums" style={{ fontSize: '1.35vw', color: '#F2F2F0' }}>
                  {ex.reps}
                </div>
                <div className="text-right tabular-nums" style={{
                  fontSize: '1.35vw',
                  color: (ex.weight_kg || ex.notes) ? '#F2F2F0' : 'rgba(242,242,240,0.3)',
                  fontWeight: (ex.weight_kg || ex.notes) ? 600 : 300,
                }}>
                  {formatLoad(ex)}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

const LEVEL_STYLES = {
  yellow: { header: 'rgba(240,193,64,0.10)', border: '#F0C140', text: '#F0C140', dot: '#F0C140' },
  red:    { header: 'rgba(224,72,72,0.10)',   border: '#E04848', text: '#E04848', dot: '#E04848' },
  green:  { header: 'rgba(61,181,106,0.10)',  border: '#3DB56A', text: '#3DB56A', dot: '#3DB56A' },
}

function GroupView({ data }: { data: Extract<SessionData, { type: 'group' }> }) {
  return (
    <div className="flex-1 flex flex-col min-h-0" style={{ background: '#080C0A', padding: '48px 56px 80px' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-8 pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div>
          <div className="text-xs font-semibold tracking-[0.16em] uppercase mb-2" style={{ color: '#FF914D' }}>
            ▸ Classe grupal en curs
          </div>
          <div className="font-black tracking-wide leading-none mb-3" style={{ fontSize: '3.2vw', color: '#F2F2F0', fontStyle: 'italic' }}>
            {data.groupName}
          </div>
          <div className="flex items-center gap-4 text-sm" style={{ color: 'rgba(242,242,240,0.4)' }}>
            <span>{new Date(data.sessionDate + 'T12:00:00').toLocaleDateString('ca-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <span style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
            <span>{data.employeeName}</span>
          </div>
        </div>
        <div className="text-right text-sm" style={{ color: 'rgba(242,242,240,0.35)' }}>
          <div className="font-semibold" style={{ color: 'rgba(242,242,240,0.7)' }}>Part Principal</div>
          <div>Adaptat per nivell</div>
        </div>
      </div>

      {/* 3 columns */}
      <div className="grid gap-3 flex-1 min-h-0" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {data.columns.map((col) => {
          const s = LEVEL_STYLES[col.color]
          return (
            <div key={col.label} className="flex flex-col rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4" style={{
                background: s.header,
                borderBottom: `2px solid ${s.border}`,
              }}>
                <span className="rounded-full shrink-0" style={{ width: 10, height: 10, background: s.dot }} />
                <span className="font-black tracking-[0.06em]" style={{ fontSize: '1.8vw', color: s.text }}>
                  {col.label}
                </span>
              </div>
              <div className="flex-1 flex flex-col gap-5 p-5 overflow-auto" style={{ background: '#111611' }}>
                {col.blocks.map((block, bi) => (
                  <div key={bi}>
                    <div className="text-xs font-semibold tracking-[0.14em] uppercase pb-2 mb-2" style={{
                      color: 'rgba(242,242,240,0.3)',
                      borderBottom: '1px solid rgba(255,255,255,0.06)'
                    }}>
                      {block.title}
                    </div>
                    {block.exercises.map((ex, ei) => (
                      <div key={ei} className="flex items-baseline justify-between gap-3 py-2"
                        style={{ borderBottom: ei < block.exercises.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                      >
                        <div className="font-normal" style={{ fontSize: '1.1vw', color: '#F2F2F0', flex: 1 }}>
                          {ex.name}
                        </div>
                        <div className="tabular-nums whitespace-nowrap font-light" style={{ fontSize: '1vw', color: 'rgba(242,242,240,0.4)' }}>
                          {ex.sets} × {ex.reps}{ex.weight_kg ? ` · ${ex.weight_kg} kg` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

async function fetchData(screenId: string): Promise<SessionData> {
  const res = await fetch(`/pantalla/${screenId}/data`, { cache: 'no-store' })
  if (!res.ok) return null
  const json = await res.json()
  return json.sessionData
}

export default function ScreenDisplay({ screenId, initialData }: Props) {
  const [data, setData] = useState<SessionData>(initialData)
  const supabase = createClient()

  // Always fetch fresh data on mount (SSR data may be stale)
  useEffect(() => {
    fetchData(screenId).then(fresh => { if (fresh !== undefined) setData(fresh) })
  }, [screenId])

  useEffect(() => {
    const channel = supabase
      .channel(`screen-${screenId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'screen_assignments',
          filter: `screen_id=eq.${screenId}`,
        },
        async () => {
          // Refetch data when assignment changes
          const res = await fetch(`/pantalla/${screenId}/data`, { cache: 'no-store' })
          if (res.ok) {
            const json = await res.json()
            setData(json.sessionData)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [screenId])

  return (
    <div className="min-h-dvh flex flex-col" style={{ background: '#080C0A' }}>
      {data ? (
        data.type === 'individual'
          ? <IndividualView data={data} />
          : <GroupView data={data} />
      ) : (
        <IdleState />
      )}
      <Logo />
    </div>
  )
}
