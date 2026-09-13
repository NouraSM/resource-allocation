import { describe, expect, it } from 'vitest'
import { calculatePortfolioImpact } from '@/engine/portfolioImpact'
import type { TeamMember, TeamScenario } from '@/engine/teamBuilder'
import type { EngineAssignment, EngineAvailability, EngineResource, OrgSettings } from '@/engine/types'

const org: OrgSettings = {
  workingDays: [0, 1, 2, 3, 4],
  dailyWorkHours: 8,
  weeklyWorkHours: 40,
  targetUtilization: 0.85,
  overloadThreshold: 0.9,
}

const TODAY = new Date('2026-09-06T00:00:00Z')
const DEADLINE = '2026-11-01'

function member(resourceId: string, allocationPercentage: number, allocatedHours: number): TeamMember {
  return {
    resourceId,
    fullName: resourceId,
    jobRole: 'contributor',
    allocationPercentage,
    allocatedHours,
    skillFitScore: 80,
    currentUtilization: 0,
    projectedUtilization: 0,
  }
}

function scenario(members: TeamMember[]): TeamScenario {
  return {
    scenarioNumber: 1,
    strategyLabel: 'Best Fit',
    members,
    teamScore: 70,
    skillCoverageScore: 80,
    capacityScore: 80,
    priorityAlignmentScore: 70,
    loadBalanceScore: 70,
    seniorityMixScore: 80,
    continuityScore: 50,
    deadlineFeasibilityScore: 80,
    deliveryRisk: { score: 20, severity: 'low', breakdown: { deadlineRisk: 20, capacityRisk: 20, skillGapRisk: 20, dependencyRisk: 20, assignmentRisk: 20 } },
    reasons: [],
    tradeoffs: [],
  }
}

function resource(id: string, department: string, weeklyCapacityHours = 40): EngineResource {
  return { id, fullName: id, department, seniorityLevel: 2, weeklyCapacityHours, active: true, skills: [] }
}

const baseParams = {
  requestId: 'req-1',
  requestDeadline: DEADLINE,
  availability: [] as EngineAvailability[],
  org,
  today: TODAY,
}

describe('portfolio impact', () => {
  it('returns null for a scenario with no feasible members', () => {
    const result = calculatePortfolioImpact({
      ...baseParams,
      scenario: scenario([]),
      allResources: [resource('r1', 'Data & Analytics')],
      allAssignments: [],
    })
    expect(result).toBeNull()
  })

  it('reports zero overload before and after when the pool has ample capacity', () => {
    const result = calculatePortfolioImpact({
      ...baseParams,
      scenario: scenario([member('r1', 30, 60)]),
      allResources: [resource('r1', 'Data & Analytics'), resource('r2', 'Data & Analytics')],
      allAssignments: [],
    })
    expect(result).not.toBeNull()
    expect(result!.overloadedResourcesBefore).toBe(0)
    expect(result!.relevantRemainingCapacityBeforeHours).toBeGreaterThan(0)
    expect(result!.relevantDepartments).toEqual(['Data & Analytics'])
  })

  it('reduces relevant remaining capacity after adding the proposed assignment', () => {
    const result = calculatePortfolioImpact({
      ...baseParams,
      scenario: scenario([member('r1', 100, 300)]),
      allResources: [resource('r1', 'Data & Analytics')],
      allAssignments: [],
    })
    expect(result!.relevantRemainingCapacityAfterHours).toBeLessThan(result!.relevantRemainingCapacityBeforeHours)
  })

  it('pushes overloaded-resource count up when the new assignment tips a member over threshold', () => {
    const result = calculatePortfolioImpact({
      ...baseParams,
      scenario: scenario([member('r1', 100, 500)]), // far more hours than fit in the horizon
      allResources: [resource('r1', 'Data & Analytics')],
      allAssignments: [],
    })
    expect(result!.overloadedResourcesBefore).toBe(0)
    expect(result!.overloadedResourcesAfter).toBe(1)
  })

  it('counts other active commitments held by proposed members, excluding the request being decided', () => {
    const existing: EngineAssignment[] = [
      { id: 'a1', resourceId: 'r1', requestId: 'other-request', allocationPercentage: 30, allocatedHours: 40, startDate: '2026-09-01', endDate: '2026-10-01', status: 'active' },
      { id: 'a2', resourceId: 'r1', requestId: 'req-1', allocationPercentage: 20, allocatedHours: 20, startDate: '2026-09-01', endDate: '2026-10-01', status: 'proposed' },
      { id: 'a3', resourceId: 'r1', requestId: 'cancelled-request', allocationPercentage: 20, allocatedHours: 20, startDate: '2026-09-01', endDate: '2026-10-01', status: 'cancelled' },
    ]
    const result = calculatePortfolioImpact({
      ...baseParams,
      scenario: scenario([member('r1', 30, 60)]),
      allResources: [resource('r1', 'Data & Analytics')],
      allAssignments: existing,
    })
    // Only a1 counts: a2 is this same request, a3 is cancelled.
    expect(result!.affectedActiveCommitments).toBe(1)
  })

  it('produces identical impact for two scenarios with identical teams', () => {
    const resources = [resource('r1', 'Data & Analytics'), resource('r2', 'Data & Analytics')]
    const a = calculatePortfolioImpact({ ...baseParams, scenario: scenario([member('r1', 40, 80)]), allResources: resources, allAssignments: [] })
    const b = calculatePortfolioImpact({ ...baseParams, scenario: scenario([member('r1', 40, 80)]), allResources: resources, allAssignments: [] })
    expect(a).toEqual(b)
  })

  it('shows negative relevant remaining capacity when the pool is already overcommitted before the decision', () => {
    const overcommitted: EngineAssignment[] = [
      { id: 'a1', resourceId: 'r1', requestId: 'other', allocationPercentage: 100, allocatedHours: 400, startDate: '2026-09-01', endDate: '2026-11-01', status: 'active' },
    ]
    const result = calculatePortfolioImpact({
      ...baseParams,
      scenario: scenario([member('r1', 10, 10)]),
      allResources: [resource('r1', 'Data & Analytics')],
      allAssignments: overcommitted,
    })
    expect(result!.relevantRemainingCapacityBeforeHours).toBeLessThan(0)
  })

  it('scopes the pool to only the department(s) of the proposed team, not the whole organization', () => {
    const result = calculatePortfolioImpact({
      ...baseParams,
      scenario: scenario([member('r1', 30, 60)]),
      allResources: [resource('r1', 'Data & Analytics'), resource('r2', 'Economics')],
      allAssignments: [],
    })
    expect(result!.relevantDepartments).toEqual(['Data & Analytics'])
  })

  it('does not double-count a duplicate resource row in the pool', () => {
    const dup = resource('r1', 'Data & Analytics')
    const a = calculatePortfolioImpact({ ...baseParams, scenario: scenario([member('r1', 30, 60)]), allResources: [dup], allAssignments: [] })
    const b = calculatePortfolioImpact({ ...baseParams, scenario: scenario([member('r1', 30, 60)]), allResources: [dup, { ...dup }], allAssignments: [] })
    expect(a!.relevantRemainingCapacityBeforeHours).toBeCloseTo(b!.relevantRemainingCapacityBeforeHours, 5)
  })
})
