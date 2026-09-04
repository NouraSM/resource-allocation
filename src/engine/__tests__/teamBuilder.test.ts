import { describe, expect, it } from 'vitest'
import { buildTeamScenarios } from '@/engine/teamBuilder'
import type { EngineAssignment, EngineResource, OrgSettings } from '@/engine/types'

const org: OrgSettings = {
  workingDays: [0, 1, 2, 3, 4],
  dailyWorkHours: 8,
  weeklyWorkHours: 40,
  targetUtilization: 0.85,
  overloadThreshold: 0.9,
}

const today = new Date('2026-09-02T00:00:00Z')

function resource(id: string, overrides: Partial<EngineResource> = {}): EngineResource {
  return {
    id,
    fullName: `Resource ${id}`,
    department: 'Strategy & Transformation',
    seniorityLevel: 3,
    weeklyCapacityHours: 40,
    active: true,
    skills: [{ skillId: 'strategy', proficiency: 4 }],
    ...overrides,
  }
}

const baseRequest = {
  id: 'req1',
  estimatedEffortHours: 200,
  requestedDeadline: '2026-11-01',
  priorityLevel: 'high' as const,
  complexity: 'medium',
  requestingEntitySector: 'Healthcare',
  requestType: 'Strategy Study',
}

const requiredSkills = [{ skillId: 'strategy', requiredLevel: 3, importanceWeight: 1.5, mandatory: true }]

describe('team builder engine', () => {
  it('returns up to 3 scenarios ranked by team score, best first', () => {
    const resources = [resource('r1'), resource('r2'), resource('r3'), resource('r4'), resource('r5')]
    const result = buildTeamScenarios({ request: baseRequest, requiredSkills, resources, assignments: [], availability: [], historicalProjects: [], org, today })
    expect(result.scenarios).toHaveLength(3)
    expect(result.scenarios[0].teamScore).toBeGreaterThanOrEqual(result.scenarios[1].teamScore)
    expect(result.scenarios[1].teamScore).toBeGreaterThanOrEqual(result.scenarios[2].teamScore)
  })

  it('every scenario covers the mandatory skill with at least one team member', () => {
    const resources = [resource('r1'), resource('r2', { skills: [] }), resource('r3', { skills: [] })]
    const result = buildTeamScenarios({ request: baseRequest, requiredSkills, resources, assignments: [], availability: [], historicalProjects: [], org, today })
    result.scenarios.forEach((scenario) => {
      if (scenario.members.length > 0) expect(scenario.skillCoverageScore).toBeGreaterThan(0)
    })
  })

  it('separates infeasible resources into notFeasible with a reason, never silently dropping them', () => {
    const inactiveResource = resource('r_inactive', { active: false })
    const resources = [resource('r1'), inactiveResource]
    const result = buildTeamScenarios({ request: baseRequest, requiredSkills, resources, assignments: [], availability: [], historicalProjects: [], org, today })
    const inactiveEval = result.notFeasible.find((c) => c.resource.id === 'r_inactive')
    expect(inactiveEval).toBeDefined()
    expect(inactiveEval!.infeasibleReasons.length).toBeGreaterThan(0)
  })

  it('handles the "all resources overloaded" edge case without throwing', () => {
    const resources = [resource('r1'), resource('r2')]
    // fully committed assignments for the whole project window
    const assignments: EngineAssignment[] = resources.map((r, i) => ({
      id: `a${i}`,
      resourceId: r.id,
      requestId: 'other-request',
      allocationPercentage: 100,
      allocatedHours: 320,
      startDate: '2026-09-02',
      endDate: '2026-11-01',
      status: 'active',
    }))
    expect(() =>
      buildTeamScenarios({ request: baseRequest, requiredSkills, resources, assignments, availability: [], historicalProjects: [], org, today }),
    ).not.toThrow()
    const result = buildTeamScenarios({ request: baseRequest, requiredSkills, resources, assignments, availability: [], historicalProjects: [], org, today })
    expect(result.scenarios).toHaveLength(3)
    expect(result.notFeasible.length).toBeGreaterThan(0)
  })

  it('reflects a request whose effort exceeds available portfolio capacity with a low capacity score', () => {
    const resources = [resource('r1'), resource('r2')]
    const hugeRequest = { ...baseRequest, estimatedEffortHours: 5000 }
    const result = buildTeamScenarios({ request: hugeRequest, requiredSkills, resources, assignments: [], availability: [], historicalProjects: [], org, today })
    expect(result.scenarios[0].capacityScore).toBeLessThan(50)
  })
})
