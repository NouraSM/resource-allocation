// Urgency Engine — derives urgency purely from working days remaining
// before a deadline. Managers may override the computed value, but the
// override + reason must be captured and audited by the caller.

const DEFAULT_WORKING_DAYS = [0, 1, 2, 3, 4] // Sun-Thu

export function workingDaysBetween(from: Date, to: Date, workingDays: number[] = DEFAULT_WORKING_DAYS): number {
  if (to <= from) return 0
  let count = 0
  const cursor = new Date(from)
  cursor.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1)
    if (workingDays.includes(cursor.getDay())) count++
  }
  return count
}

/**
 * <=3 working days = 100, 4-7 = 90, 8-14 = 75, 15-30 = 55, 31-60 = 35, >60 = 20.
 * A deadline already in the past always returns 100.
 */
export function calculateUrgencyScore(today: Date, deadline: Date, workingDays: number[] = DEFAULT_WORKING_DAYS): number {
  const startOfToday = new Date(today)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfDeadline = new Date(deadline)
  startOfDeadline.setHours(0, 0, 0, 0)

  if (startOfDeadline < startOfToday) return 100

  const days = workingDaysBetween(startOfToday, startOfDeadline, workingDays)
  if (days <= 3) return 100
  if (days <= 7) return 90
  if (days <= 14) return 75
  if (days <= 30) return 55
  if (days <= 60) return 35
  return 20
}

export interface UrgencyOverride {
  value: number
  reason: string
}

/** Resolves the effective urgency score, preferring a manager override when present. */
export function effectiveUrgencyScore(computed: number, override?: UrgencyOverride | null): number {
  if (override && typeof override.value === 'number') return clamp(override.value, 0, 100)
  return computed
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
