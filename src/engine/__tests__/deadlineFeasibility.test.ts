import { describe, expect, it } from 'vitest'
import { calculateDeadlineFeasibility } from '@/engine/deadlineFeasibility'

const today = new Date('2026-09-02T00:00:00Z')

describe('deadline feasibility engine', () => {
  it('returns 100 when there is nothing to deliver', () => {
    const result = calculateDeadlineFeasibility({ today, deadline: new Date('2026-10-01'), requiredHours: 0, availableHoursBeforeDeadline: 0 })
    expect(result.score).toBe(100)
  })

  it('returns 0 when the deadline has already passed and hours are still required', () => {
    const result = calculateDeadlineFeasibility({ today, deadline: new Date('2026-08-20'), requiredHours: 100, availableHoursBeforeDeadline: 50 })
    expect(result.score).toBe(0)
  })

  it('scores highly when available hours comfortably exceed required hours', () => {
    const result = calculateDeadlineFeasibility({ today, deadline: new Date('2026-11-01'), requiredHours: 100, availableHoursBeforeDeadline: 150 })
    expect(result.score).toBe(100)
  })

  it('lowers the score significantly when available hours fall short of required hours', () => {
    const comfortable = calculateDeadlineFeasibility({ today, deadline: new Date('2026-11-01'), requiredHours: 100, availableHoursBeforeDeadline: 100 })
    const shortfall = calculateDeadlineFeasibility({ today, deadline: new Date('2026-11-01'), requiredHours: 100, availableHoursBeforeDeadline: 40 })
    expect(shortfall.score).toBeLessThan(comfortable.score)
    expect(shortfall.score).toBeLessThan(40)
  })

  it('reports working days remaining and required weekly effort', () => {
    const result = calculateDeadlineFeasibility({ today, deadline: new Date('2026-09-16'), requiredHours: 70, availableHoursBeforeDeadline: 70 })
    expect(result.workingDaysRemaining).toBeGreaterThan(0)
    expect(result.requiredWeeklyEffort).toBeGreaterThan(0)
  })
})
