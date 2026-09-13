// Executive Attention, reframed as "decisions requiring attention" rather
// than "metrics that are high." Each item names a real decision a manager
// or director needs to make, why it matters, and where to act on it — all
// derived from the same deterministic engines used everywhere else in the
// app. Nothing here invents an alert to fill space: a calm/empty result is
// the correct output when nothing genuinely needs attention.

import type { RequestSkill, Skill, WorkRequest } from '@/types/database'
import type { EngineAssignment, EngineAvailability, EngineHistoricalProject, EngineResource, OrgSettings } from './types'
import { buildTeamScenarios } from './teamBuilder'
import type { TeamBuilderRequest } from './teamBuilder'
import { calculateCapacity, utilizationStatus } from './capacity'
import { calculateCapabilityPressure } from './capacityOutlook'

export type ExecutiveDecisionType = 'capacity_pressure' | 'allocation_decision' | 'workload_pressure'

export interface ExecutiveDecision {
  type: ExecutiveDecisionType
  headline: string
  why: string
  ctaLabel: string
  ctaPath: string
}

/** A resource must be overloaded at BOTH checkpoints to count as "persistent" rather than a one-off spike. */
const PERSISTENT_OVERLOAD_CHECKPOINTS_DAYS = [14, 42]

/** Capacity-pressure horizon: matches the Capacity Outlook page's default "8 weeks" view. */
const CAPACITY_PRESSURE_HORIZON_DAYS = 56

/** Two scenarios differing by less than this on team score are not "materially different" — same epsilon teamBuilder's own strategy comparison already uses. */
const MATERIAL_SCORE_DIFFERENCE = 5

export function deriveExecutiveDecisions(params: {
  requests: WorkRequest[]
  requestSkills: RequestSkill[]
  skills: Skill[]
  resources: EngineResource[]
  assignments: EngineAssignment[]
  availability: EngineAvailability[]
  historicalProjects: EngineHistoricalProject[]
  org: OrgSettings
  today: Date
  maxItems?: number
}): ExecutiveDecision[] {
  const { requests, requestSkills, skills, resources, assignments, availability, historicalProjects, org, today, maxItems = 3 } = params
  const decisions: ExecutiveDecision[] = []

  // --- Capacity pressure ---------------------------------------------------
  const pressureRows = calculateCapabilityPressure({
    requests,
    requestSkills,
    skills,
    resources,
    assignments,
    availability,
    org,
    today,
    horizonDays: CAPACITY_PRESSURE_HORIZON_DAYS,
  }).filter((r) => r.requestCount > 0 && (r.status === 'overloaded' || r.status === 'critical'))

  if (pressureRows.length > 0) {
    const top = pressureRows[0]
    const weeks = Math.round(CAPACITY_PRESSURE_HORIZON_DAYS / 7)
    decisions.push({
      type: 'capacity_pressure',
      headline: `${top.skillName} capability is projected to face elevated demand over the next ${weeks} weeks.`,
      why: `${top.requestCount} upcoming request${top.requestCount === 1 ? '' : 's'} depend${top.requestCount === 1 ? 's' : ''} on this capability, against ${top.qualifiedResourceCount} qualified resource${top.qualifiedResourceCount === 1 ? '' : 's'}.`,
      ctaLabel: 'Review Capacity Outlook',
      ctaPath: '/capacity-outlook',
    })
  }

  // --- Allocation decision (materially different feasible scenarios) ------
  const readyRequests = [...requests].filter((r) => r.status === 'ready_for_allocation').sort((a, b) => b.priority_score - a.priority_score).slice(0, 6)

  for (const request of readyRequests) {
    const reqSkills = requestSkills
      .filter((rs) => rs.request_id === request.id)
      .map((rs) => ({ skillId: rs.skill_id, requiredLevel: rs.required_level, importanceWeight: rs.importance_weight, mandatory: rs.mandatory }))

    // Mirrors the exact request shape AllocationWorkspace builds today, so
    // this preview never disagrees with what the workspace itself shows.
    const builderRequest: TeamBuilderRequest = {
      id: request.id,
      estimatedEffortHours: request.estimated_effort_hours,
      requestedDeadline: request.requested_deadline,
      priorityLevel: request.priority_level,
      complexity: request.complexity,
      requestingEntitySector: request.request_type,
      requestType: request.request_type,
    }
    const result = buildTeamScenarios({ request: builderRequest, requiredSkills: reqSkills, resources, assignments, availability, historicalProjects, org, today })
    const withMembers = result.scenarios.filter((s) => s.members.length > 0)
    if (withMembers.length < 2) continue

    const scores = withMembers.map((s) => s.teamScore)
    const spread = Math.max(...scores) - Math.min(...scores)
    if (spread < MATERIAL_SCORE_DIFFERENCE) continue

    decisions.push({
      type: 'allocation_decision',
      headline: `${request.title} has multiple feasible allocation scenarios.`,
      why: `Alternatives range from ${Math.min(...scores).toFixed(0)} to ${Math.max(...scores).toFixed(0)} on team fit and create different portfolio-capacity impacts.`,
      ctaLabel: 'Compare Scenarios',
      ctaPath: `/allocation/${request.id}`,
    })
    break // one concrete example is the point — not every eligible request
  }

  // --- Workload pressure (persistent overload) -----------------------------
  const persistentlyOverloaded = resources.filter((r) => r.active).filter((r) =>
    PERSISTENT_OVERLOAD_CHECKPOINTS_DAYS.every((days) => {
      const rangeEnd = new Date(today)
      rangeEnd.setDate(rangeEnd.getDate() + days)
      const capacity = calculateCapacity({ resource: r, org, assignments, availability, rangeStart: today, rangeEnd })
      const status = utilizationStatus(capacity.utilization, org)
      return status === 'overloaded' || status === 'critical'
    }),
  )

  if (persistentlyOverloaded.length > 0) {
    const names = persistentlyOverloaded.map((r) => r.fullName)
    const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? `, and ${names.length - 3} other${names.length - 3 === 1 ? '' : 's'}` : '')
    decisions.push({
      type: 'workload_pressure',
      headline: `${persistentlyOverloaded.length} resource${persistentlyOverloaded.length === 1 ? '' : 's'} remain${persistentlyOverloaded.length === 1 ? 's' : ''} above the organization's configured overload threshold across multiple upcoming periods.`,
      why: `${shown} ${persistentlyOverloaded.length === 1 ? 'is' : 'are'} affected, based on projected utilization at both the 2-week and 6-week checkpoints.`,
      ctaLabel: 'Review Resources',
      ctaPath: '/resources',
    })
  }

  return decisions.slice(0, maxItems)
}
