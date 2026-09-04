import type { EngineAssignment, EngineAvailability, EngineHistoricalProject, EngineRequiredSkill, EngineResource, OrgSettings, PriorityLevel } from './types'
import { calculateCapacity, calculateCapacityScore, utilizationStatus } from './capacity'
import type { CapacityBreakdown } from './capacity'
import { calculateSkillMatch } from './skillMatch'
import type { SkillMatchResult } from './skillMatch'
import { calculateExperienceScore } from './experience'
import { calculateWorkloadBalanceScore } from './workloadBalance'
import { calculateDeadlineFeasibility } from './deadlineFeasibility'
import { calculateResourceFitScore, calculateContinuityScore, checkHardFilters } from './resourceFit'
import { calculateDeliveryRisk } from './risk'
import type { DeliveryRiskResult } from './risk'

const MIN_SENIORITY_BY_COMPLEXITY: Record<string, number> = { low: 1, medium: 2, high: 3, very_high: 4 }
const MAX_TEAM_SIZE = 5

export interface TeamBuilderRequest {
  id: string
  estimatedEffortHours: number
  requestedDeadline: string
  priorityLevel: PriorityLevel
  complexity: string
  requestingEntitySector?: string | null
  requestType?: string | null
}

export interface TeamBuilderParams {
  request: TeamBuilderRequest
  requiredSkills: EngineRequiredSkill[]
  resources: EngineResource[]
  assignments: EngineAssignment[]
  availability: EngineAvailability[]
  historicalProjects: EngineHistoricalProject[]
  org: OrgSettings
  today: Date
}

export interface CandidateEvaluation {
  resource: EngineResource
  skillMatch: SkillMatchResult
  capacity: CapacityBreakdown
  experienceScore: number
  continuityScore: number
  soloFitScore: number
  feasible: boolean
  infeasibleReasons: string[]
}

export interface TeamMember {
  resourceId: string
  fullName: string
  jobRole: 'lead' | 'contributor'
  allocationPercentage: number
  allocatedHours: number
  skillFitScore: number
  currentUtilization: number
  projectedUtilization: number
}

export interface TeamScenario {
  scenarioNumber: 1 | 2 | 3
  strategyLabel: string
  members: TeamMember[]
  teamScore: number
  skillCoverageScore: number
  capacityScore: number
  priorityAlignmentScore: number
  loadBalanceScore: number
  seniorityMixScore: number
  continuityScore: number
  deadlineFeasibilityScore: number
  deliveryRisk: DeliveryRiskResult
  reasons: string[]
  tradeoffs: string[]
}

export interface TeamBuilderResult {
  candidates: CandidateEvaluation[]
  notFeasible: CandidateEvaluation[]
  scenarios: TeamScenario[]
}

export function evaluateCandidates(params: TeamBuilderParams): CandidateEvaluation[] {
  const { request, requiredSkills, resources, assignments, availability, historicalProjects, org, today } = params
  const deadline = new Date(request.requestedDeadline)
  const minSeniority = MIN_SENIORITY_BY_COMPLEXITY[request.complexity] ?? 1

  return resources.map((resource) => {
    const skillMatch = calculateSkillMatch(requiredSkills, resource.skills)
    const capacity = calculateCapacity({ resource, org, assignments, availability, rangeStart: today, rangeEnd: deadline })
    const experienceScore = calculateExperienceScore(
      historicalProjects.filter((h) => h.resourceId === resource.id),
      { sector: request.requestingEntitySector, projectType: request.requestType },
    )
    const continuityScore = calculateContinuityScore({
      alreadyAssignedToRequest: assignments.some((a) => a.resourceId === resource.id && a.requestId === request.id && a.status !== 'cancelled'),
      hasRelevantHistory: historicalProjects.some((h) => h.resourceId === resource.id && (h.sector === request.requestingEntitySector || h.projectType === request.requestType)),
    })

    const { feasible, reasons } = checkHardFilters({
      resource,
      skillMatch,
      capacity,
      requiredHours: request.estimatedEffortHours,
      minSeniorityLevel: minSeniority,
      seniorityMandatory: request.complexity === 'very_high',
    })

    const capacityScore = calculateCapacityScore(capacity.availableCapacityHours, request.estimatedEffortHours)
    const deadlineResult = calculateDeadlineFeasibility({
      today,
      deadline,
      requiredHours: request.estimatedEffortHours,
      availableHoursBeforeDeadline: capacity.availableCapacityHours,
      workingDays: org.workingDays,
    })
    const workloadBalanceScore = calculateWorkloadBalanceScore(capacity.utilization)

    const soloFitScore = calculateResourceFitScore({
      skillMatchScore: skillMatch.score,
      capacityScore,
      experienceScore,
      deadlineScore: deadlineResult.score,
      workloadBalanceScore,
      continuityScore,
    })

    return { resource, skillMatch, capacity, experienceScore, continuityScore, soloFitScore, feasible, infeasibleReasons: reasons }
  })
}

type Strategy = 'best_fit' | 'balanced_workload' | 'skill_coverage'

function orderCandidates(feasible: CandidateEvaluation[], strategy: Strategy): CandidateEvaluation[] {
  const copy = [...feasible]
  if (strategy === 'best_fit') {
    return copy.sort((a, b) => b.soloFitScore - a.soloFitScore)
  }
  if (strategy === 'balanced_workload') {
    return copy.sort((a, b) => {
      const balanceDiff = calculateWorkloadBalanceScore(b.capacity.utilization) - calculateWorkloadBalanceScore(a.capacity.utilization)
      if (Math.abs(balanceDiff) > 5) return balanceDiff
      return b.soloFitScore - a.soloFitScore
    })
  }
  // skill_coverage: prioritize resources that best cover mandatory skills first
  return copy.sort((a, b) => {
    const mandatoryDiff = mandatoryCoverageStrength(b) - mandatoryCoverageStrength(a)
    if (Math.abs(mandatoryDiff) > 1) return mandatoryDiff
    return b.soloFitScore - a.soloFitScore
  })
}

function mandatoryCoverageStrength(candidate: CandidateEvaluation): number {
  return candidate.skillMatch.details.filter((d) => d.mandatory).reduce((sum, d) => sum + d.matchPercent, 0)
}

function buildTeam(ordered: CandidateEvaluation[], request: TeamBuilderRequest, requiredSkills: EngineRequiredSkill[], exclude: Set<string> = new Set()): CandidateEvaluation[] {
  const pool = ordered.filter((c) => !exclude.has(c.resource.id))
  const mandatorySkillIds = new Set(requiredSkills.filter((s) => s.mandatory).map((s) => s.skillId))
  const team: CandidateEvaluation[] = []
  let remainingHours = request.estimatedEffortHours
  const covered = new Set<string>()

  for (const candidate of pool) {
    if (team.length >= MAX_TEAM_SIZE) break
    const stillNeedsHours = remainingHours > 0
    const stillNeedsSkills = [...mandatorySkillIds].some((id) => !covered.has(id))
    if (!stillNeedsHours && !stillNeedsSkills) break

    const coversNewMandatorySkill = candidate.skillMatch.details.some((d) => d.mandatory && !d.missing && !covered.has(d.skillId))
    if (!stillNeedsHours && !coversNewMandatorySkill) continue

    team.push(candidate)
    remainingHours -= candidate.capacity.availableCapacityHours
    candidate.skillMatch.details.forEach((d) => {
      if (d.mandatory && !d.missing) covered.add(d.skillId)
    })
  }

  // last resort: pull in the single best remaining candidate for any mandatory skill still uncovered
  for (const skillId of mandatorySkillIds) {
    if (covered.has(skillId)) continue
    const best = pool
      .filter((c) => !team.includes(c))
      .find((c) => c.skillMatch.details.some((d) => d.skillId === skillId && !d.missing))
    if (best) {
      team.push(best)
      covered.add(skillId)
    }
  }

  return team
}

function toScenario(
  scenarioNumber: 1 | 2 | 3,
  strategyLabel: string,
  team: CandidateEvaluation[],
  request: TeamBuilderRequest,
  requiredSkills: EngineRequiredSkill[],
  org: OrgSettings,
  today: Date,
): TeamScenario {
  const deadline = new Date(request.requestedDeadline)
  let remainingHours = request.estimatedEffortHours

  const members: TeamMember[] = team.map((candidate, index) => {
    const allocatedHours = Math.max(0, Math.min(candidate.capacity.availableCapacityHours, Math.max(remainingHours, 0) || candidate.capacity.availableCapacityHours * 0.25))
    remainingHours -= allocatedHours
    const allocationPercentage = candidate.capacity.grossCapacityHours > 0 ? Math.min(100, Math.round((allocatedHours / candidate.capacity.grossCapacityHours) * 100)) : 0
    const projectedUtilization = candidate.capacity.grossCapacityHours > 0 ? (candidate.capacity.assignedHours + allocatedHours) / candidate.capacity.grossCapacityHours : 0
    return {
      resourceId: candidate.resource.id,
      fullName: candidate.resource.fullName,
      jobRole: index === 0 ? 'lead' : 'contributor',
      allocationPercentage,
      allocatedHours: Math.round(allocatedHours),
      skillFitScore: candidate.skillMatch.score,
      currentUtilization: Math.round(candidate.capacity.utilization * 1000) / 10,
      projectedUtilization: Math.round(projectedUtilization * 1000) / 10,
    }
  })

  const totalAllocatedHours = members.reduce((sum, m) => sum + m.allocatedHours, 0)

  // Skill coverage: for each required skill, best (max) match among team members, weighted.
  const totalWeight = requiredSkills.reduce((s, r) => s + (r.importanceWeight || 1), 0) || 1
  const skillCoverageScore = requiredSkills.length
    ? requiredSkills.reduce((sum, req) => {
        const best = Math.max(0, ...team.map((c) => c.skillMatch.details.find((d) => d.skillId === req.skillId)?.matchPercent ?? 0))
        return sum + best * (req.importanceWeight || 1)
      }, 0) / totalWeight
    : 100

  const capacityScore = calculateCapacityScore(totalAllocatedHours, request.estimatedEffortHours)
  const priorityAlignmentScore = team.length ? round2(team.reduce((s, c) => s + c.soloFitScore, 0) / team.length) : 0
  const loadBalanceScore = members.length
    ? round2(members.reduce((s, m) => s + calculateWorkloadBalanceScore(m.projectedUtilization / 100), 0) / members.length)
    : 0

  const minSeniority = MIN_SENIORITY_BY_COMPLEXITY[request.complexity] ?? 1
  const meetsMinSeniority = team.some((c) => c.resource.seniorityLevel >= minSeniority)
  const distinctLevels = new Set(team.map((c) => c.resource.seniorityLevel)).size
  const seniorityMixScore = (meetsMinSeniority ? 75 : 35) + Math.min(25, distinctLevels * 10)

  const continuityScore = team.length ? round2(team.reduce((s, c) => s + c.continuityScore, 0) / team.length) : 0

  const deadlineFeasibility = calculateDeadlineFeasibility({
    today,
    deadline,
    requiredHours: request.estimatedEffortHours,
    availableHoursBeforeDeadline: team.reduce((s, c) => s + c.capacity.availableCapacityHours, 0),
    workingDays: org.workingDays,
  })

  const teamScore =
    skillCoverageScore * 0.3 +
    capacityScore * 0.25 +
    priorityAlignmentScore * 0.15 +
    loadBalanceScore * 0.15 +
    Math.min(100, seniorityMixScore) * 0.1 +
    continuityScore * 0.05

  const assignmentCoverageScore = calculateCapacityScore(totalAllocatedHours, request.estimatedEffortHours)
  const deliveryRisk = calculateDeliveryRisk({
    deadlineFeasibilityScore: deadlineFeasibility.score,
    capacityScore,
    skillCoverageScore,
    dependencyImpact: 30, // portfolio-level dependency risk is layered in by the caller when known
    assignmentCoverageScore,
  })

  const reasons: string[] = []
  const tradeoffs: string[] = []
  if (skillCoverageScore >= 85) reasons.push('Strong mandatory and secondary skill coverage across the team.')
  if (capacityScore >= 80) reasons.push('Team has enough available capacity to cover the estimated effort.')
  if (loadBalanceScore < 50) tradeoffs.push('One or more members would be pushed toward a high utilization band.')
  if (skillCoverageScore < 70) tradeoffs.push('Some required skills are only partially covered.')
  if (members.length <= 1) tradeoffs.push('Single point of failure — no backup coverage if this person becomes unavailable.')
  if (!reasons.length) reasons.push('Best available combination given current capacity and skill constraints.')

  return {
    scenarioNumber,
    strategyLabel,
    members,
    teamScore: round2(Math.min(100, Math.max(0, teamScore))),
    skillCoverageScore: round2(skillCoverageScore),
    capacityScore: round2(capacityScore),
    priorityAlignmentScore,
    loadBalanceScore,
    seniorityMixScore: Math.min(100, seniorityMixScore),
    continuityScore,
    deadlineFeasibilityScore: deadlineFeasibility.score,
    deliveryRisk,
    reasons,
    tradeoffs,
  }
}

/** Builds up to 3 ranked team scenarios using a bounded greedy search over top-ranked candidates (never brute force). */
export function buildTeamScenarios(params: TeamBuilderParams): TeamBuilderResult {
  const evaluations = evaluateCandidates(params)
  const feasible = evaluations.filter((c) => c.feasible)
  const notFeasible = evaluations.filter((c) => !c.feasible)

  const strategies: { strategy: Strategy; label: string }[] = [
    { strategy: 'best_fit', label: 'Best Fit' },
    { strategy: 'balanced_workload', label: 'Balanced Workload' },
    { strategy: 'skill_coverage', label: 'Skill-Coverage First' },
  ]

  const seen: Set<string> = new Set()
  const teams: CandidateEvaluation[][] = []
  const labels: string[] = []

  for (const { strategy, label } of strategies) {
    const ordered = orderCandidates(feasible, strategy)
    let team = buildTeam(ordered, params.request, params.requiredSkills)
    let key = team.map((c) => c.resource.id).sort().join('|')
    if (seen.has(key) && team.length) {
      // force variation: exclude the current top pick and rebuild
      const exclude = new Set([team[0].resource.id])
      const altTeam = buildTeam(ordered, params.request, params.requiredSkills, exclude)
      if (altTeam.length) {
        team = altTeam
        key = team.map((c) => c.resource.id).sort().join('|')
      }
    }
    seen.add(key)
    teams.push(team)
    labels.push(label)
  }

  const scenarios = teams
    .map((team, i) => toScenario((i + 1) as 1 | 2 | 3, labels[i], team, params.request, params.requiredSkills, params.org, params.today))
    .sort((a, b) => b.teamScore - a.teamScore)
    .map((scenario, i) => ({ ...scenario, scenarioNumber: (i + 1) as 1 | 2 | 3 }))

  return { candidates: evaluations, notFeasible, scenarios }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export { utilizationStatus }
