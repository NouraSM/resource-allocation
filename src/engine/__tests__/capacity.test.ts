import { describe, expect, it } from 'vitest'
import {
  calculateAssignedHours,
  calculateCapacity,
  calculateCapacityScore,
  calculateGrossCapacity,
  calculateUnavailableHours,
  calculateUtilization,
  utilizationStatus,
} from '@/engine/capacity'
import type { EngineAssignment, EngineAvailability, EngineResource, OrgSettings } from '@/engine/types'

const org: OrgSettings = {
  workingDays: [0, 1, 2, 3, 4],
  dailyWorkHours: 8,
  weeklyWorkHours: 40,
  targetUtilization: 0.85,
  overloadThreshold: 0.9,
}

const resource: EngineResource = {
  id: 'r1',
  fullName: 'Test Resource',
  department: 'Strategy',
  seniorityLevel: 3,
  weeklyCapacityHours: 40,
  active: true,
  skills: [],
}

const RANGE_START = new Date('2026-09-06T00:00:00Z') // Sunday
const RANGE_END = new Date('2026-09-13T00:00:00Z') // next Sunday, one working week later

describe('capacity engine', () => {
  it('computes gross capacity for a full working week', () => {
    expect(calculateGrossCapacity(resource, org, RANGE_START, RANGE_END)).toBe(40)
  })

  it('prorates gross capacity for a part-time resource', () => {
    const partTime = { ...resource, weeklyCapacityHours: 20 }
    expect(calculateGrossCapacity(partTime, org, RANGE_START, RANGE_END)).toBe(20)
  })

  it('subtracts leave hours from unavailable hours', () => {
    const availability: EngineAvailability[] = [
      { resourceId: 'r1', date: '2026-09-08', availableHours: 0, availabilityType: 'leave' },
    ]
    const unavailable = calculateUnavailableHours(resource, org, availability, RANGE_START, RANGE_END)
    expect(unavailable).toBe(8) // one full standard day off
  })

  it('prorates assignment hours across their span for the requested range', () => {
    const assignments: EngineAssignment[] = [
      {
        id: 'a1',
        resourceId: 'r1',
        requestId: 'req1',
        allocationPercentage: 50,
        allocatedHours: 100,
        startDate: '2026-09-06',
        endDate: '2026-09-19', // two working weeks
        status: 'active',
      },
    ]
    const assigned = calculateAssignedHours(resource, org, assignments, RANGE_START, RANGE_END)
    // The one-week window overlaps 6 of the assignment's 10 working days.
    expect(assigned).toBeCloseTo(60, 0)
  })

  it('ignores cancelled assignments', () => {
    const assignments: EngineAssignment[] = [
      { id: 'a1', resourceId: 'r1', requestId: 'req1', allocationPercentage: 50, allocatedHours: 100, startDate: '2026-09-06', endDate: '2026-09-12', status: 'cancelled' },
    ]
    expect(calculateAssignedHours(resource, org, assignments, RANGE_START, RANGE_END)).toBe(0)
  })

  it('computes available_capacity = gross - assigned - unavailable', () => {
    const assignments: EngineAssignment[] = [
      { id: 'a1', resourceId: 'r1', requestId: 'req1', allocationPercentage: 50, allocatedHours: 20, startDate: '2026-09-06', endDate: '2026-09-12', status: 'active' },
    ]
    const availability: EngineAvailability[] = [{ resourceId: 'r1', date: '2026-09-08', availableHours: 0, availabilityType: 'leave' }]
    const result = calculateCapacity({ resource, org, assignments, availability, rangeStart: RANGE_START, rangeEnd: RANGE_END })
    expect(result.grossCapacityHours).toBe(40)
    expect(result.assignedHours).toBe(20)
    expect(result.unavailableHours).toBe(8)
    expect(result.availableCapacityHours).toBe(12)
  })

  it('handles the zero-capacity edge case without dividing by zero', () => {
    const zeroCapacity = { ...resource, weeklyCapacityHours: 0 }
    const result = calculateCapacity({ resource: zeroCapacity, org, assignments: [], availability: [], rangeStart: RANGE_START, rangeEnd: RANGE_END })
    expect(result.grossCapacityHours).toBe(0)
    expect(Number.isFinite(result.utilization)).toBe(true)
    expect(calculateUtilization(0, 0)).toBe(0)
  })

  it.each([
    [0.3, 'underutilized'],
    [0.6, 'healthy'],
    [0.85, 'healthy'],
    [0.87, 'high'],
    [0.9, 'high'],
    [0.95, 'overloaded'],
    [1.0, 'overloaded'],
    [1.2, 'critical'],
  ])('maps utilization %s to status %s using org thresholds', (utilization, status) => {
    expect(utilizationStatus(utilization, org)).toBe(status)
  })

  it('caps capacity_score at 100 and avoids division by zero when nothing is requested', () => {
    expect(calculateCapacityScore(10, 0)).toBe(100)
    expect(calculateCapacityScore(0, 0)).toBe(100)
    expect(calculateCapacityScore(50, 100)).toBe(50)
    expect(calculateCapacityScore(150, 100)).toBe(100)
    expect(calculateCapacityScore(0, 100)).toBe(0)
  })
})
