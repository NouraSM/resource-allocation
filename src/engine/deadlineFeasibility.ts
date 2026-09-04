import { workingDaysBetween } from './urgency'

export interface DeadlineFeasibilityParams {
  today: Date
  deadline: Date
  requiredHours: number
  availableHoursBeforeDeadline: number
  workingDays?: number[]
}

export interface DeadlineFeasibilityResult {
  score: number // 0-100
  workingDaysRemaining: number
  requiredWeeklyEffort: number
  coverageRatio: number // availableHours / requiredHours
}

/**
 * Deadline feasibility compares the hours realistically available before
 * the deadline against the hours the work actually requires. Falling short
 * lowers the score sharply, per spec.
 */
export function calculateDeadlineFeasibility(params: DeadlineFeasibilityParams): DeadlineFeasibilityResult {
  const { today, deadline, requiredHours, availableHoursBeforeDeadline, workingDays = [0, 1, 2, 3, 4] } = params
  const workingDaysRemaining = workingDaysBetween(today, deadline, workingDays)
  const weeksRemaining = Math.max(workingDaysRemaining / workingDays.length, 1 / workingDays.length)
  const requiredWeeklyEffort = requiredHours > 0 ? round2(requiredHours / weeksRemaining) : 0

  if (requiredHours <= 0) {
    return { score: 100, workingDaysRemaining, requiredWeeklyEffort, coverageRatio: 1 }
  }
  if (workingDaysRemaining <= 0) {
    return { score: 0, workingDaysRemaining, requiredWeeklyEffort, coverageRatio: 0 }
  }

  const coverageRatio = availableHoursBeforeDeadline / requiredHours
  const score = scoreFromRatio(coverageRatio)
  return { score, workingDaysRemaining, requiredWeeklyEffort, coverageRatio: round2(coverageRatio) }
}

function scoreFromRatio(ratio: number): number {
  if (ratio >= 1.2) return 100
  if (ratio >= 1.0) return round2(85 + (ratio - 1.0) * 75)
  if (ratio >= 0.7) return round2(40 + (ratio - 0.7) * (45 / 0.3))
  if (ratio >= 0.4) return round2(15 + (ratio - 0.4) * (25 / 0.3))
  return round2(Math.max(0, (ratio / 0.4) * 15))
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
