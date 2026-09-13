import { describe, expect, it } from 'vitest'
import { calculateCapabilityPressure, SENIOR_LEVEL_THRESHOLD } from '@/engine/capacityOutlook'
import type { EngineAssignment, EngineAvailability, EngineResource, OrgSettings } from '@/engine/types'
import type { RequestSkill, Skill, WorkRequest } from '@/types/database'

const org: OrgSettings = {
  workingDays: [0, 1, 2, 3, 4],
  dailyWorkHours: 8,
  weeklyWorkHours: 40,
  targetUtilization: 0.85,
  overloadThreshold: 0.9,
}

const TODAY = new Date('2026-09-06T00:00:00Z') // Sunday

function skill(id: string, name = id, active = true): Skill {
  return { id, organization_id: 'org1', name, name_ar: null, category: 'general', active }
}

function request(id: string, hours: number, deadlineDaysOut: number, status: WorkRequest['status'] = 'ready_for_allocation'): WorkRequest {
  const deadline = new Date(TODAY)
  deadline.setDate(deadline.getDate() + deadlineDaysOut)
  return {
    id,
    organization_id: 'org1',
    request_number: id,
    title: id,
    title_ar: null,
    description: '',
    requesting_entity: 'Test Entity',
    requester_name: 'Tester',
    request_type: null,
    received_date: '2026-09-01',
    requested_deadline: deadline.toISOString().slice(0, 10),
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
    estimated_effort_hours: hours,
    complexity: 'medium',
    status,
    created_by: null,
    created_at: '2026-09-01',
    updated_at: '2026-09-01',
  }
}

function reqSkill(requestId: string, skillId: string, importanceWeight = 1): RequestSkill {
  return { id: `${requestId}-${skillId}`, organization_id: 'org1', request_id: requestId, skill_id: skillId, required_level: 3, importance_weight: importanceWeight, mandatory: true }
}

function resource(id: string, skillIds: { skillId: string; proficiency?: number }[], seniorityLevel = 2, weeklyCapacityHours = 40): EngineResource {
  return {
    id,
    fullName: id,
    department: 'Dept',
    seniorityLevel,
    weeklyCapacityHours,
    active: true,
    skills: skillIds.map((s) => ({ skillId: s.skillId, proficiency: s.proficiency ?? 3 })),
  }
}

const baseParams = {
  assignments: [] as EngineAssignment[],
  availability: [] as EngineAvailability[],
  org,
  today: TODAY,
  horizonDays: 28,
}

describe('capacity outlook — capability pressure', () => {
  it('returns an empty-safe result with zero data', () => {
    const rows = calculateCapabilityPressure({ ...baseParams, requests: [], requestSkills: [], skills: [], resources: [] })
    expect(rows).toEqual([])
  })

  it('produces a row per active skill even with no demand, with a healthy/no-pressure status', () => {
    const rows = calculateCapabilityPressure({
      ...baseParams,
      requests: [],
      requestSkills: [],
      skills: [skill('s1', 'Data Analysis')],
      resources: [resource('r1', [{ skillId: 's1' }])],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].requestCount).toBe(0)
    expect(rows[0].estimatedDemandHours).toBe(0)
    expect(rows[0].status).toBe('underutilized')
  })

  it('excludes inactive skills', () => {
    const rows = calculateCapabilityPressure({
      ...baseParams,
      requests: [],
      requestSkills: [],
      skills: [skill('s1', 'Retired Skill', false)],
      resources: [],
    })
    expect(rows).toHaveLength(0)
  })

  it('does NOT inflate demand when one request requires multiple skills — splits by importance weight and sums back to the request total', () => {
    const r1 = request('r1', 300, 20)
    const rows = calculateCapabilityPressure({
      ...baseParams,
      requests: [r1],
      requestSkills: [reqSkill('r1', 'data', 1.5), reqSkill('r1', 'powerbi', 1), reqSkill('r1', 'ba', 0.5)],
      skills: [skill('data'), skill('powerbi'), skill('ba')],
      resources: [],
    })
    const total = rows.reduce((sum, row) => sum + row.estimatedDemandHours, 0)
    expect(total).toBeCloseTo(300, 5)
    // weight 1.5 of 3 total -> 150h; weight 1 -> 100h; weight 0.5 -> 50h
    const byId = Object.fromEntries(rows.map((r) => [r.skillId, r.estimatedDemandHours]))
    expect(byId.data).toBeCloseTo(150, 5)
    expect(byId.powerbi).toBeCloseTo(100, 5)
    expect(byId.ba).toBeCloseTo(50, 5)
  })

  it('splits evenly when importance weights are missing/zero (falls back to 1 each, matching teamBuilder convention)', () => {
    const r1 = request('r1', 90, 20)
    const rows = calculateCapabilityPressure({
      ...baseParams,
      requests: [r1],
      requestSkills: [reqSkill('r1', 'a', 0), reqSkill('r1', 'b', 0), reqSkill('r1', 'c', 0)],
      skills: [skill('a'), skill('b'), skill('c')],
      resources: [],
    })
    for (const row of rows) expect(row.estimatedDemandHours).toBeCloseTo(30, 5)
  })

  it('aggregates demand from multiple overlapping requests on the same skill without double counting each request', () => {
    const r1 = request('r1', 100, 10)
    const r2 = request('r2', 200, 15)
    const rows = calculateCapabilityPressure({
      ...baseParams,
      requests: [r1, r2],
      requestSkills: [reqSkill('r1', 's1'), reqSkill('r2', 's1')],
      skills: [skill('s1')],
      resources: [],
    })
    expect(rows[0].estimatedDemandHours).toBeCloseTo(300, 5)
    expect(rows[0].requestCount).toBe(2)
  })

  it('excludes requests outside the selected horizon', () => {
    const inHorizon = request('r1', 100, 10)
    const outOfHorizon = request('r2', 500, 200)
    const rows = calculateCapabilityPressure({
      ...baseParams,
      horizonDays: 28,
      requests: [inHorizon, outOfHorizon],
      requestSkills: [reqSkill('r1', 's1'), reqSkill('r2', 's1')],
      skills: [skill('s1')],
      resources: [],
    })
    expect(rows[0].estimatedDemandHours).toBeCloseTo(100, 5)
    expect(rows[0].requestCount).toBe(1)
  })

  it('excludes completed/cancelled/draft requests from demand regardless of deadline', () => {
    const completed = request('r1', 100, 10, 'completed')
    const cancelled = request('r2', 100, 10, 'cancelled')
    const draft = request('r3', 100, 10, 'draft')
    const rows = calculateCapabilityPressure({
      ...baseParams,
      requests: [completed, cancelled, draft],
      requestSkills: [reqSkill('r1', 's1'), reqSkill('r2', 's1'), reqSkill('r3', 's1')],
      skills: [skill('s1')],
      resources: [],
    })
    expect(rows[0].estimatedDemandHours).toBe(0)
    expect(rows[0].requestCount).toBe(0)
  })

  it('respects 4/8/12-week horizons independently', () => {
    const r4 = request('r4', 100, 20) // within 4 weeks
    const r8 = request('r8', 100, 50) // within 8 weeks only
    const r12 = request('r12', 100, 80) // within 12 weeks only
    const commonParams = {
      ...baseParams,
      requests: [r4, r8, r12],
      requestSkills: [reqSkill('r4', 's1'), reqSkill('r8', 's1'), reqSkill('r12', 's1')],
      skills: [skill('s1')],
      resources: [],
    }
    const at4w = calculateCapabilityPressure({ ...commonParams, horizonDays: 28 })
    const at8w = calculateCapabilityPressure({ ...commonParams, horizonDays: 56 })
    const at12w = calculateCapabilityPressure({ ...commonParams, horizonDays: 84 })
    expect(at4w[0].estimatedDemandHours).toBeCloseTo(100, 5)
    expect(at8w[0].estimatedDemandHours).toBeCloseTo(200, 5)
    expect(at12w[0].estimatedDemandHours).toBeCloseTo(300, 5)
  })

  it('counts a resource holding multiple skills toward each skill independently (documented, not a bug)', () => {
    const rows = calculateCapabilityPressure({
      ...baseParams,
      requests: [],
      requestSkills: [],
      skills: [skill('s1'), skill('s2')],
      resources: [resource('r1', [{ skillId: 's1' }, { skillId: 's2' }])],
    })
    const s1 = rows.find((r) => r.skillId === 's1')!
    const s2 = rows.find((r) => r.skillId === 's2')!
    expect(s1.qualifiedResourceCount).toBe(1)
    expect(s2.qualifiedResourceCount).toBe(1)
    expect(s1.availableCapacityHours).toBeCloseTo(s2.availableCapacityHours, 5)
  })

  it('does not double-count a duplicate resource row for the same skill', () => {
    const dup: EngineResource = resource('r1', [{ skillId: 's1' }])
    const rows = calculateCapabilityPressure({
      ...baseParams,
      requests: [],
      requestSkills: [],
      skills: [skill('s1')],
      resources: [dup, { ...dup }],
    })
    expect(rows[0].qualifiedResourceCount).toBe(1)
  })

  it('flags a capability with demand but zero qualified resources as a critical gap', () => {
    const r1 = request('r1', 200, 10)
    const rows = calculateCapabilityPressure({
      ...baseParams,
      requests: [r1],
      requestSkills: [reqSkill('r1', 's1')],
      skills: [skill('s1')],
      resources: [], // nobody holds it
    })
    expect(rows[0].status).toBe('critical')
    expect(rows[0].pressureRatio).toBeGreaterThan(1)
  })

  it('uses the organization overload threshold, not a hardcoded generic cutoff, for pressure status', () => {
    const r1 = request('r1', 100, 10)
    const looseOrg: OrgSettings = { ...org, targetUtilization: 0.5, overloadThreshold: 0.6 }
    const rowsDefault = calculateCapabilityPressure({
      ...baseParams,
      requests: [r1],
      requestSkills: [reqSkill('r1', 's1')],
      skills: [skill('s1')],
      resources: [resource('r1res', [{ skillId: 's1' }], 2, 40)],
    })
    const rowsLooseOrg = calculateCapabilityPressure({
      ...baseParams,
      org: looseOrg,
      requests: [r1],
      requestSkills: [reqSkill('r1', 's1')],
      skills: [skill('s1')],
      resources: [resource('r1res', [{ skillId: 's1' }], 2, 40)],
    })
    // Same underlying numbers, different org policy -> status can legitimately differ.
    expect(rowsDefault[0].pressureRatio).toBeCloseTo(rowsLooseOrg[0].pressureRatio, 5)
    expect(rowsLooseOrg[0].status).not.toBe(rowsDefault[0].status)
  })

  it('shows negative available capacity when the qualified pool is already overcommitted (not floored at zero)', () => {
    const overcommitted: EngineAssignment[] = [
      { id: 'a1', resourceId: 'r1', requestId: 'other', allocationPercentage: 100, allocatedHours: 200, startDate: '2026-09-06', endDate: '2026-10-04', status: 'active' },
    ]
    const rows = calculateCapabilityPressure({
      ...baseParams,
      assignments: overcommitted,
      requests: [],
      requestSkills: [],
      skills: [skill('s1')],
      resources: [resource('r1', [{ skillId: 's1' }], 2, 40)],
    })
    expect(rows[0].availableCapacityHours).toBeLessThan(0)
  })

  it('reports senior-qualified resource count using the shared seniority threshold', () => {
    const rows = calculateCapabilityPressure({
      ...baseParams,
      requests: [],
      requestSkills: [],
      skills: [skill('s1')],
      resources: [resource('junior', [{ skillId: 's1' }], SENIOR_LEVEL_THRESHOLD - 1), resource('senior', [{ skillId: 's1' }], SENIOR_LEVEL_THRESHOLD)],
    })
    expect(rows[0].qualifiedResourceCount).toBe(2)
    expect(rows[0].seniorQualifiedResourceCount).toBe(1)
  })

  it('sorts rows by pressure ratio descending', () => {
    const highDemand = request('r1', 1000, 10)
    const lowDemand = request('r2', 10, 10)
    const rows = calculateCapabilityPressure({
      ...baseParams,
      requests: [highDemand, lowDemand],
      requestSkills: [reqSkill('r1', 'hot'), reqSkill('r2', 'cold')],
      skills: [skill('cold'), skill('hot')],
      resources: [resource('r1', [{ skillId: 'hot' }, { skillId: 'cold' }], 2, 40)],
    })
    expect(rows[0].skillId).toBe('hot')
  })
})
