import { describe, expect, it } from 'vitest'
import { calculateUrgencyScore, effectiveUrgencyScore, workingDaysBetween } from '@/engine/urgency'

// Wednesday, matches the org's default Sun-Thu working week
const TODAY = new Date('2026-09-02T00:00:00Z')

describe('urgency engine', () => {
  it('returns 100 for a deadline that has already passed', () => {
    const deadline = new Date('2026-08-20T00:00:00Z')
    expect(calculateUrgencyScore(TODAY, deadline)).toBe(100)
  })

  it('returns 100 for a deadline that is today', () => {
    expect(calculateUrgencyScore(TODAY, TODAY)).toBe(100)
  })

  it('returns 100 within <=3 working days', () => {
    const deadline = new Date('2026-09-06T00:00:00Z') // Sunday, 2 working days out
    expect(calculateUrgencyScore(TODAY, deadline)).toBe(100)
  })

  it('returns 90 for 4-7 working days', () => {
    const deadline = new Date('2026-09-09T00:00:00Z')
    const days = workingDaysBetween(TODAY, deadline)
    expect(days).toBeGreaterThanOrEqual(4)
    expect(days).toBeLessThanOrEqual(7)
    expect(calculateUrgencyScore(TODAY, deadline)).toBe(90)
  })

  it('returns 75 for 8-14 working days', () => {
    const deadline = new Date('2026-09-16T00:00:00Z')
    expect(calculateUrgencyScore(TODAY, deadline)).toBe(75)
  })

  it('returns 55 for 15-30 working days', () => {
    const deadline = new Date('2026-09-28T00:00:00Z')
    expect(calculateUrgencyScore(TODAY, deadline)).toBe(55)
  })

  it('returns 35 for 31-60 working days', () => {
    const deadline = new Date('2026-10-20T00:00:00Z')
    expect(calculateUrgencyScore(TODAY, deadline)).toBe(35)
  })

  it('returns 20 for more than 60 working days out', () => {
    const deadline = new Date('2027-03-01T00:00:00Z')
    expect(calculateUrgencyScore(TODAY, deadline)).toBe(20)
  })

  it('excludes weekend days (Fri/Sat) from the working-day count', () => {
    // Wed Sep 2 -> Wed Sep 9 spans 7 calendar days; Fri 4 and Sat 5 are
    // excluded, leaving Thu, Sun, Mon, Tue, Wed = 5 working days.
    const nextWednesday = new Date('2026-09-09T00:00:00Z')
    expect(workingDaysBetween(TODAY, nextWednesday)).toBe(5)
  })

  it('lets a manager override the computed urgency', () => {
    const computed = calculateUrgencyScore(TODAY, new Date('2027-03-01T00:00:00Z'))
    expect(computed).toBe(20)
    expect(effectiveUrgencyScore(computed, { value: 95, reason: 'Executive escalation' })).toBe(95)
  })

  it('falls back to the computed score when there is no override', () => {
    expect(effectiveUrgencyScore(55, null)).toBe(55)
  })
})
