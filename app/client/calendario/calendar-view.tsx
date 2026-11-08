'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ChevronRight as Arrow } from 'lucide-react'
import {
  STATUS_LABEL, capitalizeFirst, formatTimeRange, sessionTypeLabel,
  type MiSesion, type SessionStatus,
} from '@/lib/client-portal/types'

type CalSesion = Pick<MiSesion,
  'source_id' | 'session_date' | 'session_time' | 'duration_min' | 'type' | 'session_label' | 'status'>

type Props = {
  sesiones: CalSesion[]
  festivos: { date: string; name: string }[]
  today: string
  firstMonth: string   // 'YYYY-MM'
  lastMonth: string
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

const MARK: Record<SessionStatus, { symbol: string; className: string }> = {
  completed: { symbol: '✓', className: 'text-green-400' },
  missed: { symbol: '✗', className: 'text-red-300' },
  scheduled: { symbol: '●', className: 'text-[var(--brand)]' },
  unrecorded: { symbol: '·', className: 'text-white/40' },
  cancelled: { symbol: '–', className: 'text-white/30' },
}

// Si un día tiene varias sesiones, se marca con la más relevante.
const PRIORITY: SessionStatus[] = ['scheduled', 'missed', 'completed', 'unrecorded', 'cancelled']

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function CalendarView({ sesiones, festivos, today, firstMonth, lastMonth }: Props) {
  const [month, setMonth] = useState(today.slice(0, 7))
  const [selected, setSelected] = useState(today)

  const byDate = useMemo(() => {
    const map = new Map<string, CalSesion[]>()
    for (const s of sesiones) map.set(s.session_date, [...(map.get(s.session_date) ?? []), s])
    return map
  }, [sesiones])
  const holidays = useMemo(() => new Map(festivos.map(f => [f.date, f.name])), [festivos])

  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const startDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const cells: (string | null)[] = Array(startDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${month}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedSessions = byDate.get(selected) ?? []
  const selectedHoliday = holidays.get(selected)

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#1C1C1C] rounded-2xl border border-white/10 p-4">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setMonth(shiftMonth(month, -1))}
            disabled={month <= firstMonth}
            aria-label="Mes anterior"
            className="w-11 h-11 flex items-center justify-center rounded-full text-white/60 hover:bg-white/5 disabled:opacity-20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="font-semibold">{MONTHS[m - 1]} {y}</p>
          <button
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= lastMonth}
            aria-label="Mes siguiente"
            className="w-11 h-11 flex items-center justify-center rounded-full text-white/60 hover:bg-white/5 disabled:opacity-20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] text-white/35 mb-1">
          {WEEKDAYS.map(d => <div key={d} className="py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={i} />
            const day = Number(date.slice(8))
            const list = byDate.get(date) ?? []
            const status = PRIORITY.find(p => list.some(s => s.status === p))
            const isHoliday = holidays.has(date)
            const isToday = date === today
            const isSelected = date === selected
            return (
              <button
                key={date}
                onClick={() => setSelected(date)}
                className={`h-12 rounded-xl flex flex-col items-center justify-center text-sm transition-colors ${
                  isSelected ? 'bg-white/10' : 'hover:bg-white/5'
                } ${isToday ? 'ring-1 ring-[var(--brand)]' : ''} ${list.length || isHoliday ? 'text-white' : 'text-white/35'}`}
              >
                <span className={isToday ? 'font-bold' : ''}>{day}</span>
                <span className={`text-[11px] leading-none h-3 ${status ? MARK[status].className : 'text-white/35'}`}>
                  {status ? MARK[status].symbol : isHoliday ? 'F' : ''}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-[11px] text-white/45">
          <span><span className="text-green-400">✓</span> hecha</span>
          <span><span className="text-red-300">✗</span> no asistida</span>
          <span><span className="text-[var(--brand)]">●</span> prevista</span>
          <span>F festivo</span>
          <span>– cancelada</span>
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-white/70 mb-2">
          {capitalizeFirst(new Date(selected + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }))}
        </h2>
        {selectedHoliday && (
          <p className="text-sm text-white/50 mb-2">Festivo: {selectedHoliday}</p>
        )}
        {selectedSessions.length === 0 ? (
          !selectedHoliday && <p className="text-sm text-white/40">No hay sesión este día.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {selectedSessions.map(s => (
              <li key={s.source_id}>
                <Link
                  href={`/client/sesion/${s.source_id}`}
                  className="flex items-center justify-between gap-3 bg-[#1C1C1C] rounded-xl border border-white/10 px-4 py-3 active:bg-white/5"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {formatTimeRange(s.session_time, s.duration_min) ?? 'Sin hora'} · {sessionTypeLabel(s)}
                    </p>
                    <p className={`text-xs ${MARK[s.status].className}`}>{STATUS_LABEL[s.status]}</p>
                  </div>
                  <Arrow className="h-4 w-4 text-white/30" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
