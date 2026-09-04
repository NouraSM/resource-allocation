import type { EngineResource } from './types'
import type { CapacityBreakdown } from './capacity'
import type { SkillMatchResult } from './skillMatch'

export const RESOURCE_FIT_WEIGHTS = {
  skillMatch: 0.35,
  capacity: 0.25,
  experience: 0.15,
  deadline: 0.1,
  workloadBalance: 0.1,
  continuity: 0.05,
} as const

export interface ResourceFitComponents {
  skillMatchScore: number
  capacityScore: number
  experienceScore: number
  deadlineScore: number
  workloadBalanceScore: number
  continuityScore: number
}

export function calculateResourceFitScore(components: ResourceFitComponents): number {
  const raw =
    components.skillMatchScore * RESOURCE_FIT_WEIGHTS.skillMatch +
    components.capacityScore * RESOURCE_FIT_WEIGHTS.capacity +
    components.experienceScore * RESOURCE_FIT_WEIGHTS.experience +
    components.deadlineScore * RESOURCE_FIT_WEIGHTS.deadline +
    components.workloadBalanceScore * RESOURCE_FIT_WEIGHTS.workloadBalance +
    components.continuityScore * RESOURCE_FIT_WEIGHTS.continuity
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100
}

export function calculateContinuityScore(params: { alreadyAssignedToRequest: boolean; hasRelevantHistory: boolean }): number {
  if (params.alreadyAssignedToRequest) return 100
  if (params.hasRelevantHistory) return 70
  return 40
}

// ---------------------------------------------------------------------------
// Hard filters — infeasible candidates are never hidden, only labeled.
// ---------------------------------------------------------------------------

export interface HardFilterParams {
  resource: EngineResource
  skillMatch: SkillMatchResult
  capacity: CapacityBreakdown
  requiredHours: number
  minSeniorityLevel?: number
  seniorityMandatory?: boolean
}

export interface HardFilterResult {
  feasible: boolean
  reasons: string[]
}

export function checkHardFilters(params: HardFilterParams): HardFilterResult {
  const { resource, skillMatch, capacity, requiredHours, minSeniorityLevel, seniorityMandatory } = params
  const reasons: string[] = []

  if (!resource.active) {
    reasons.push('Resource is inactive.')
  }
  if (skillMatch.hasMandatoryGap) {
    reasons.push('Missing one or more mandatory skills required by this request.')
  }
  if (capacity.grossCapacityHours > 0 && capacity.unavailableHours / capacity.grossCapacityHours > 0.6) {
    reasons.push('Unavailable (leave/training) for most of the project period.')
  }
  if (capacity.availableCapacityHours <= 0) {
    reasons.push('No meaningful capacity available in the project period.')
  }
  if (seniorityMandatory && typeof minSeniorityLevel === 'number' && resource.seniorityLevel < minSeniorityLevel) {
    reasons.push(`Seniority level ${resource.seniorityLevel} is below the required level ${minSeniorityLevel}.`)
  }
  if (requiredHours > 0 && capacity.availableCapacityHours > 0 && capacity.availableCapacityHours < requiredHours * 0.1) {
    reasons.push('Available capacity covers less than 10% of the hours this request would need from this resource.')
  }

  return { feasible: reasons.length === 0, reasons }
}
