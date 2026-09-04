import { describe, expect, it } from 'vitest'
import { applyWhatIfChanges, compareUtilization, recommendationFromComparisons, snapshotResourceUtilization } from '@/engine/scenario'
import type { EngineAssignment, EngineResource, OrgSettings } from '@/engine/types'

const org: OrgSettings = {
  workingDays: [0, 1, 2, 3, 4],
  dailyWorkHours: 8,
  weeklyWorkHours: 40,
  targetUtilization: 0.85,
  overloadThreshold: 0.9,
}

const sara: EngineResource = {
  id: 'sara',
  fullName: 'Sara',
  department: 'Strategy & Transformation',
  seniorityLevel: 3,
  weeklyCapacityHours: 40,
  active: true,
  skills: [],
}

const rangeStart = new Date('2026-09-06T00:00:00Z')
const rangeEnd = new Date('2026-10-04T00:00:00Z') // 4 working weeks

describe('what-if scenario engine', () => {
  it('never mutates the original assignments/availability arrays', () => {
    const assignments: EngineAssignment[] = []
    const availability: never[] = []
    const result = applyWhatIfChanges({
      assignments,
      availability,
      changes: [{ kind: 'assign_resource', assignment: { id: 'new1', resourceId: 'sara', requestId: 'req1', allocationPercentage: 50, allocatedHours: 80, startDate: '2026-09-06', endDate: '2026-10-04', status: 'proposed' } }],
    })
    expect(assignments).toHaveLength(0)
    expect(result.assignments).toHaveLength(1)
  })

  it('shows utilization moving from a healthy level to overloaded when a large new assignment is added', () => {
    const existing: EngineAssignment = { id: 'existing', resourceId: 'sara', requestId: 'req0', allocationPercentage: 70, allocatedHours: 112, startDate: '2026-09-06', endDate: '2026-10-04', status: 'active' }
    const before = { assignments: [existing], availability: [] }
    const after = applyWhatIfChanges({
      assignments: [existing],
      availability: [],
      changes: [{ kind: 'assign_resource', assignment: { id: 'new1', resourceId: 'sara', requestId: 'req1', allocationPercentage: 40, allocatedHours: 64, startDate: '2026-09-06', endDate: '2026-10-04', status: 'proposed' } }],
    })

    const comparison = compareUtilization(sara, org, before, after, rangeStart, rangeEnd)
    expect(comparison.after.utilization).toBeGreaterThan(comparison.before.utilization)
    expect(comparison.before.status).toBe('healthy')
    expect(comparison.after.utilization).toBeGreaterThan(100)
  })

  it('simulating an absence reduces available capacity to zero for the leave days', () => {
    const after = applyWhatIfChanges({
      assignments: [],
      availability: [],
      changes: [{ kind: 'simulate_absence', resourceId: 'sara', startDate: '2026-09-06', endDate: '2026-09-10', reason: 'Annual leave' }],
    })
    const snapshot = snapshotResourceUtilization(sara, org, after.assignments, after.availability, rangeStart, rangeEnd)
    expect(snapshot.availableCapacityHours).toBeLessThan(40 * 4)
  })

  it('recommends against approval when a resource would exceed 100% utilization', () => {
    const comparisons = [
      {
        before: { resourceId: 'sara', fullName: 'Sara', utilization: 72, status: 'healthy' as const, availableCapacityHours: 40 },
        after: { resourceId: 'sara', fullName: 'Sara', utilization: 106, status: 'critical' as const, availableCapacityHours: -10 },
      },
    ]
    const recommendation = recommendationFromComparisons(comparisons, [])
    expect(recommendation).toMatch(/do not approve/i)
    expect(recommendation).toMatch(/106%/)
  })

  it('recommends approval when nothing gets worse', () => {
    const comparisons = [
      {
        before: { resourceId: 'sara', fullName: 'Sara', utilization: 50, status: 'healthy' as const, availableCapacityHours: 40 },
        after: { resourceId: 'sara', fullName: 'Sara', utilization: 60, status: 'healthy' as const, availableCapacityHours: 30 },
      },
    ]
    const recommendation = recommendationFromComparisons(comparisons, [])
    expect(recommendation).toMatch(/safe to approve/i)
  })
})
