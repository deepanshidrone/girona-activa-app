export type SessionLabel = 'A' | 'B' | 'C'

// 4-week cycle pattern (20 working days: 4 × Mon-Fri)
// Week 4 has the same block structure as Week 1 (trainer adjusts loads manually)
export const CYCLE_PATTERN_20: SessionLabel[] = [
  'A','A','B','B','C', // week 1
  'B','B','C','C','A', // week 2
  'C','C','A','A','B', // week 3
  'A','A','B','B','C', // week 4 (deload — same structure, trainer adjusts)
]

// The "simultaneous" block at the same first hour follows the next block in rotation
export const NEXT_BLOCK: Record<SessionLabel, SessionLabel> = { A:'B', B:'C', C:'A' }

// Predefined intra-day time slots per day of week (0=Mon … 4=Fri)
// hasOverlap: true = first hour has 2 simultaneous sessions (primary block + next block)
export const DAY_SLOT_TEMPLATE: Record<number, { time: string; hasOverlap: boolean }[]> = {
  0: [ // Monday
    { time: '07:00', hasOverlap: true  },
    { time: '09:30', hasOverlap: false },
    { time: '11:00', hasOverlap: false },
    { time: '15:30', hasOverlap: false },
    { time: '17:00', hasOverlap: false },
    { time: '19:00', hasOverlap: false },
    { time: '20:00', hasOverlap: false },
  ],
  1: [ // Tuesday — same as Monday
    { time: '07:00', hasOverlap: true  },
    { time: '09:30', hasOverlap: false },
    { time: '11:00', hasOverlap: false },
    { time: '15:30', hasOverlap: false },
    { time: '17:00', hasOverlap: false },
    { time: '19:00', hasOverlap: false },
    { time: '20:00', hasOverlap: false },
  ],
  2: [ // Wednesday
    { time: '07:00', hasOverlap: true  },
    { time: '09:30', hasOverlap: false },
    { time: '11:00', hasOverlap: false },
    { time: '15:30', hasOverlap: false },
    { time: '17:00', hasOverlap: false },
    { time: '19:00', hasOverlap: false },
    { time: '20:00', hasOverlap: false },
  ],
  3: [ // Thursday — same as Wednesday
    { time: '07:00', hasOverlap: true  },
    { time: '09:30', hasOverlap: false },
    { time: '11:00', hasOverlap: false },
    { time: '15:30', hasOverlap: false },
    { time: '17:00', hasOverlap: false },
    { time: '19:00', hasOverlap: false },
    { time: '20:00', hasOverlap: false },
  ],
  4: [ // Friday — no overlap, fewer sessions
    { time: '07:00', hasOverlap: false },
    { time: '09:30', hasOverlap: false },
    { time: '11:00', hasOverlap: false },
    { time: '15:30', hasOverlap: false },
    { time: '17:00', hasOverlap: false },
  ],
}

export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
export const DAY_SHORT  = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv']

/** Returns the actual calendar date for a given day_index within a cycle */
export function getDayDate(startDate: string, day_index: number): Date {
  const d = new Date(startDate + 'T12:00:00')
  const week      = Math.floor(day_index / 5)
  const dayOfWeek = day_index % 5
  d.setDate(d.getDate() + week * 7 + dayOfWeek)
  return d
}

/**
 * Given a cycle's start_date and today's date, returns the day_index for today
 * (0–19), or null if today is not a working day within the cycle.
 */
export function getTodayDayIndex(startDate: string): number | null {
  const start = new Date(startDate + 'T12:00:00')
  start.setHours(0, 0, 0, 0)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - start.getTime()) / 86_400_000)

  if (diffDays >= 0 && diffDays <= 4)   return diffDays          // week 1
  if (diffDays >= 7 && diffDays <= 11)  return 5  + (diffDays - 7)  // week 2
  if (diffDays >= 14 && diffDays <= 18) return 10 + (diffDays - 14) // week 3
  if (diffDays >= 21 && diffDays <= 25) return 15 + (diffDays - 21) // week 4
  return null
}
