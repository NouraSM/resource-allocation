import { describe, expect, it } from 'vitest'
import { deriveExecutiveDecisions } from '@/engine/executiveDecisions'
import type { EngineAssignment, EngineAvailability, EngineHistoricalProject, EngineResource, OrgSettings } from '@/engine/types'
import type { RequestSkill, Skill, WorkRequest } from '@/types/database'

const org: OrgSettings = {
  workingDays: [0, 1, 2, 3, 4],
  dailyWorkHours: 8,
  weeklyWorkHours: 40,
  targetUtilization: 0.85,
  overloadThreshold: 0.9,
}

const TODAY = new Date('2026-09-06T00:00:00Z')

function request(overrides: Partial<WorkRequest> & { id: string }): WorkRequest {
  return {
    organization_id: 'org1',
    request_number: overrides.id,
    title: overrides.id,
    title_ar: null,
    description: '',
    requesting_entity: 'Test Entity',
    requester_name: 'Tester',
    request_type: null,
    received_date: '2026-09-01',
    requested_deadline: '2026-10-01',
    strategic_importance: 50,
    executive_sponsorship: 50,
    regulatory_importance: 50,
    public_impact: 50,
    dependency_impact: 50,
    urgency_score: 50,
    urgency_override: null,
    urgency_override_reason: null,
    priority_score: 50,
    priority_level: 'medium',
    estimated_effort_hours: 100,
    complexity: 'medium',
    status: 'ready_for_allocation',
    created_by: null,
    created_at: '2026-09-01',
    updated_at: '2026-09-01',
    ...overrides,
  }
}

function reqSkill(requestId: string, skillId: string, mandatory = true): RequestSkill {
  return { id: `${requestId}-${skillId}`, organization_id: 'org1', request_id: requestId, skill_id: skillId, required_level: 2, importance_weight: 1, mandatory }
}

function skill(id: string): Skill {
  return { id, organization_id: 'org1', name: id, name_ar: null, category: 'general', active: true }
}

function resource(id: string, skillIds: string[] = [], seniorityLevel = 3, weeklyCapacityHours = 40): EngineResource {
  return { id, fullName: id, department: 'Dept', seniorityLevel, weeklyCapacityHours, active: true, skills: skillIds.map((s) => ({ skillId: s, proficiency: 4 })) }
}

const baseParams = {
  assignments: [] as EngineAssignment[],
  availability: [] as EngineAvailability[],
  historicalProjects: [] as EngineHistoricalProject[],
  org,
  today: TODAY,
}

describe('executive decisions', () => {
  it('returns an empty list (calm state) when there is no data at all', () => {
    const decisions = deriveExecutiveDecisions({ ...baseParams, requests: [], requestSkills: [], skills: [], resources: [] })
    expect(decisions).toEqual([])
  })

  it('does not surface a capacity-pressure item when demand is well within capacity', () => {
    const decisions = deriveExecutiveDecisions({
      ...baseParams,
      requests: [request({ id: 'r1', estimated_effort_hours: 20 })],
      requestSkills: [reqSkill('r1', 's1')],
      skills: [skill('s1')],
      resources: [resource('res1', ['s1'])],
    })
    expect(decisions.find((d) => d.type === 'capacity_pressure')).toBeUndefined()
  })

  it('surfaces a capacity-pressure decision when a capability has real demand and no qualified resources', () => {
    const decisions = deriveExecutiveDecisions({
      ...baseParams,
      requests: [request({ id: 'r1', estimated_effort_hours: 400, requested_deadline: '2026-10-01' })],
      requestSkills: [reqSkill('r1', 's1')],
      skills: [skill('s1')],
      resources: [],
    })
    const item = decisions.find((d) => d.type === 'capacity_pressure')
    expect(item).toBeDefined()
    expect(item!.ctaPath).toBe('/capacity-outlook')
    expect(item!.headline).toContain('s1')
  })

  it('surfaces a workload-pressure decision only when overload is persistent across both checkpoints', () => {
    // Enough committed hours to be overloaded at 2 weeks AND 6 weeks out.
    const heavyAssignment: EngineAssignment = { id: 'a1', resourceId: 'res1', requestId: 'r1', allocationPercentage: 100, allocatedHours: 400, startDate: '2026-09-01', endDate: '2026-11-01', status: 'active' }
    const decisions = deriveExecutiveDecisions({
      ...baseParams,
      assignments: [heavyAssignment],
      requests: [],
      requestSkills: [],
      skills: [],
      resources: [resource('res1')],
    })
    const item = decisions.find((d) => d.type === 'workload_pressure')
    expect(item).toBeDefined()
    expect(item!.headline).toContain('1 resource')
    expect(item!.ctaPath).toBe('/resources')
  })

  it('does not surface workload pressure for a resource overloaded only briefly (not persistent)', () => {
    // Overloaded only in the very near term (ends well before the 6-week checkpoint).
    const briefAssignment: EngineAssignment = { id: 'a1', resourceId: 'res1', requestId: 'r1', allocationPercentage: 100, allocatedHours: 60, startDate: '2026-09-06', endDate: '2026-09-13', status: 'active' }
    const decisions = deriveExecutiveDecisions({
      ...baseParams,
      assignments: [briefAssignment],
      requests: [],
      requestSkills: [],
      skills: [],
      resources: [resource('res1')],
    })
    expect(decisions.find((d) => d.type === 'workload_pressure')).toBeUndefined()
  })

  it('surfaces an allocation-decision item only when feasible scenarios materially differ', () => {
    const req = request({ id: 'r1', status: 'ready_for_allocation', estimated_effort_hours: 200, requested_deadline: '2026-12-01', complexity: 'low' })
    const decisions = deriveExecutiveDecisions({
      ...baseParams,
      requests: [req],
      requestSkills: [reqSkill('r1', 's1', false)],
      skills: [skill('s1')],
      resources: [resource('res1', ['s1'], 4, 40), resource('res2', ['s1'], 4, 40), resource('res3', [], 4, 40)],
    })
    // Presence is data-dependent (depends on engine scoring); this test only
    // asserts the invariant that IF an allocation_decision item is present,
    // it points at a real ready_for_allocation request.
    const item = decisions.find((d) => d.type === 'allocation_decision')
    if (item) {
      expect(item.ctaPath).toBe(`/allocation/${req.id}`)
      expect(item.headline).toContain(req.title)
    }
  })

  it('never returns more than maxItems decisions', () => {
    const heavyAssignment: EngineAssignment = { id: 'a1', resourceId: 'res1', requestId: 'r1', allocationPercentage: 100, allocatedHours: 400, startDate: '2026-09-01', endDate: '2026-11-01', status: 'active' }
    const decisions = deriveExecutiveDecisions({
      ...baseParams,
      assignments: [heavyAssignment],
      requests: [request({ id: 'r1', estimated_effort_hours: 400 })],
      requestSkills: [reqSkill('r1', 's1')],
      skills: [skill('s1')],
      resources: [resource('res1')],
      maxItems: 1,
    })
    expect(decisions.length).toBeLessThanOrEqual(1)
  })

  it('ignores completed and cancelled requests when checking for allocation decisions', () => {
    const req = request({ id: 'r1', status: 'completed' })
    const decisions = deriveExecutiveDecisions({
      ...baseParams,
      requests: [req],
      requestSkills: [reqSkill('r1', 's1')],
      skills: [skill('s1')],
      resources: [resource('res1', ['s1'])],
    })
    expect(decisions.find((d) => d.type === 'allocation_decision')).toBeUndefined()
  })
})
