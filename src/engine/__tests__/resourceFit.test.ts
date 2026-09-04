import { describe, expect, it } from 'vitest'
import { calculateResourceFitScore, calculateContinuityScore, checkHardFilters } from '@/engine/resourceFit'
import type { EngineResource } from '@/engine/types'
import type { CapacityBreakdown } from '@/engine/capacity'
import { calculateSkillMatch } from '@/engine/skillMatch'

const resource: EngineResource = {
  id: 'r1',
  fullName: 'Test Resource',
  department: 'Strategy',
  seniorityLevel: 3,
  weeklyCapacityHours: 40,
  active: true,
  skills: [{ skillId: 's1', proficiency: 4 }],
}

const healthyCapacity: CapacityBreakdown = {
  grossCapacityHours: 40,
  assignedHours: 10,
  unavailableHours: 0,
  availableCapacityHours: 30,
  utilization: 0.25,
}

describe('resource fit engine', () => {
  it('combines weighted components into a single 0-100 score', () => {
    const score = calculateResourceFitScore({
      skillMatchScore: 100,
      capacityScore: 100,
      experienceScore: 100,
      deadlineScore: 100,
      workloadBalanceScore: 100,
      continuityScore: 100,
    })
    expect(score).toBe(100)
  })

  it('weights skill match the heaviest at 35%', () => {
    const highSkill = calculateResourceFitScore({ skillMatchScore: 100, capacityScore: 0, experienceScore: 0, deadlineScore: 0, workloadBalanceScore: 0, continuityScore: 0 })
    const highCapacity = calculateResourceFitScore({ skillMatchScore: 0, capacityScore: 100, experienceScore: 0, deadlineScore: 0, workloadBalanceScore: 0, continuityScore: 0 })
    expect(highSkill).toBeGreaterThan(highCapacity)
    expect(highSkill).toBe(35)
    expect(highCapacity).toBe(25)
  })

  it('rates continuity highest for an already-assigned resource', () => {
    expect(calculateContinuityScore({ alreadyAssignedToRequest: true, hasRelevantHistory: false })).toBe(100)
    expect(calculateContinuityScore({ alreadyAssignedToRequest: false, hasRelevantHistory: true })).toBe(70)
    expect(calculateContinuityScore({ alreadyAssignedToRequest: false, hasRelevantHistory: false })).toBe(40)
  })

  it('passes a feasible, active, well-skilled resource with capacity', () => {
    const skillMatch = calculateSkillMatch([{ skillId: 's1', requiredLevel: 3, importanceWeight: 1, mandatory: true }], resource.skills)
    const result = checkHardFilters({ resource, skillMatch, capacity: healthyCapacity, requiredHours: 40 })
    expect(result.feasible).toBe(true)
    expect(result.reasons).toHaveLength(0)
  })

  it('marks an inactive resource as not feasible', () => {
    const skillMatch = calculateSkillMatch([], resource.skills)
    const result = checkHardFilters({ resource: { ...resource, active: false }, skillMatch, capacity: healthyCapacity, requiredHours: 40 })
    expect(result.feasible).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/inactive/i)
  })

  it('marks a resource missing a mandatory skill as not feasible', () => {
    const skillMatch = calculateSkillMatch([{ skillId: 'missing', requiredLevel: 3, importanceWeight: 1, mandatory: true }], resource.skills)
    const result = checkHardFilters({ resource, skillMatch, capacity: healthyCapacity, requiredHours: 40 })
    expect(result.feasible).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/mandatory skill/i)
  })

  it('marks a resource with no meaningful capacity as not feasible', () => {
    const skillMatch = calculateSkillMatch([], resource.skills)
    const noCapacity: CapacityBreakdown = { ...healthyCapacity, availableCapacityHours: 0 }
    const result = checkHardFilters({ resource, skillMatch, capacity: noCapacity, requiredHours: 40 })
    expect(result.feasible).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/no meaningful capacity/i)
  })

  it('marks a resource unavailable for most of the period as not feasible', () => {
    const skillMatch = calculateSkillMatch([], resource.skills)
    const mostlyOnLeave: CapacityBreakdown = { grossCapacityHours: 40, assignedHours: 0, unavailableHours: 30, availableCapacityHours: 10, utilization: 0 }
    const result = checkHardFilters({ resource, skillMatch, capacity: mostlyOnLeave, requiredHours: 40 })
    expect(result.feasible).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/unavailable/i)
  })
})
