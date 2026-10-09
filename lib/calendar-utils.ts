// Calendar utilities for working-day-aware date generation

export function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isWeekend(d: Date): boolean {
  const dow = d.getDay() // 0=Sun, 6=Sat
  return dow === 0 || dow === 6
}

// Generate the actual calendar dates for the N working days of a cycle,
// skipping weekends and active holidays.
// Returns an array of length N where each element is 'YYYY-MM-DD' (or null if holiday was skipped — but we skip silently).
export function generateCycleDates(
  startDate: string,
  workingDays: number,
  holidaySet: Set<string>
): string[] {
  const dates: string[] = []
  const cursor = new Date(startDate + 'T12:00:00')

  while (dates.length < workingDays) {
    const dateStr = toLocalDateString(cursor)
    if (!isWeekend(cursor) && !holidaySet.has(dateStr)) {
      dates.push(dateStr)
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

// For UI: given a cycle's start_date, generate the FULL calendar grid
// (including weekend/holiday cells) up to the last working day of the cycle.
// Returns day entries with their date + whether they are a working day in the cycle.
export type CalendarDay = {
  date: string
  dayIndex: number | null  // null = non-working (weekend / holiday)
  holidayName: string | null
  isWeekend: boolean
}

export function generateCycleCalendarGrid(
  startDate: string,
  workingDays: number,
  holidays: { date: string; name: string; is_active: boolean }[]
): CalendarDay[] {
  const holidayMap = new Map(holidays.filter(h => h.is_active).map(h => [h.date, h.name]))
  const holidayAllMap = new Map(holidays.map(h => [h.date, h]))

  const grid: CalendarDay[] = []
  const cursor = new Date(startDate + 'T12:00:00')
  let workingDayIndex = 0

  while (workingDayIndex < workingDays) {
    const dateStr = toLocalDateString(cursor)
    const weekend = isWeekend(cursor)
    const holiday = holidayMap.get(dateStr)

    if (!weekend && !holiday) {
      grid.push({ date: dateStr, dayIndex: workingDayIndex, holidayName: null, isWeekend: false })
      workingDayIndex++
    } else {
      const inactiveHoliday = !weekend && holidayAllMap.get(dateStr)
      grid.push({
        date: dateStr,
        dayIndex: null,
        holidayName: holiday ?? (inactiveHoliday ? inactiveHoliday.name : null),
        isWeekend: weekend,
      })
    }

    cursor.setDate(cursor.getDate() + 1)
  }

  return grid
}
