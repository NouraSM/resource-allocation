// Portfolio Impact — "a scenario can be strong for this request while
// creating a worse outcome for the wider organization." This reuses the
// exact same primitives WhatIfDialog already uses (calculateCapacity +
// applyWhatIfChanges) at a wider scope: instead of one resource, every
// resource in the affected department(s). It never touches teamBuilder's
// request-level scoring/ranking — this is a separate, additive lens.

import type { TeamScenario } from './teamBuilder'
import type { EngineAssignment, EngineAvailability, EngineResource, OrgSettings } from './types'
import { calculateCapacity, utilizationStatus } from './capacity'
import { applyWhatIfChanges } from './scenario'

/** Matches the forward window WhatIfDialog already uses for before/after utilization comparisons. */
export const PORTFOLIO_IMPACT_HORIZON_DAYS = 60

export interface PortfolioImpact {
  /** Department(s) the proposed team belongs to — the capability pool this decision draws from. */
  relevantDepartments: string[]
  overloadedResourcesBefore: number
  overloadedResourcesAfter: number
  relevantRemainingCapacityBeforeHours: number
  relevantRemainingCapacityAfterHours: number
  /** Other active/proposed commitments the proposed team members already hold, excluding this request. */
  affectedActiveCommitments: number
}

export function calculatePortfolioImpact(params: {
  scenario: TeamScenario
  requestId: string
  requestDeadline: string
  allResources: EngineResource[]
  allAssignments: EngineAssignment[]
  availability: EngineAvailability[]
  org: OrgSettings
  today: Date
  horizonDays?: number
}): PortfolioImpact | null {
  const { scenario, requestId, requestDeadline, allResources, allAssignments, availability, org, today, horizonDays = PORTFOLIO_IMPACT_HORIZON_DAYS } = params

  // Nothing to assess for a scenario with no feasible team.
  if (scenario.members.length === 0) return null

  const memberIds = new Set(scenario.members.map((m) => m.resourceId))
  const uniqueResources = Array.from(new Map(allResources.map((r) => [r.id, r])).values())
  const relevantDepartments = Array.from(new Set(uniqueResources.filter((r) => memberIds.has(r.id)).map((r) => r.department)))
  const pool = uniqueResources.filter((r) => r.active && relevantDepartments.includes(r.department))

  const rangeStart = today
  const rangeEnd = new Date(today)
  rangeEnd.setDate(rangeEnd.getDate() + horizonDays)

  const countOverloaded = (assignmentsSet: EngineAssignment[]) =>
    pool.filter((r) => {
      const capacity = calculateCapacity({ resource: r, org, assignments: assignmentsSet, availability, rangeStart, rangeEnd })
      const status = utilizationStatus(capacity.utilization, org)
      return status === 'overloaded' || status === 'critical'
    }).length

  const sumRemainingCapacity = (assignmentsSet: EngineAssignment[]) =>
    pool.reduce((sum, r) => sum + calculateCapacity({ resource: r, org, assignments: assignmentsSet, availability, rangeStart, rangeEnd }).availableCapacityHours, 0)

  const overloadedResourcesBefore = countOverloaded(allAssignments)
  const relevantRemainingCapacityBeforeHours = round2(sumRemainingCapacity(allAssignments))

  const proposedEndDate = requestDeadline || rangeEnd.toISOString().slice(0, 10)
  const changes = scenario.members.map((m, i) => ({
    kind: 'assign_resource' as const,
    assignment: {
      id: `portfolio-impact-${i}`,
      resourceId: m.resourceId,
      requestId,
      allocationPercentage: m.allocationPercentage,
      allocatedHours: m.allocatedHours,
      startDate: today.toISOString().slice(0, 10),
      endDate: proposedEndDate,
      status: 'proposed' as const,
    },
  }))
  const after = applyWhatIfChanges({ assignments: allAssignments, availability: [], changes })

  const overloadedResourcesAfter = countOverloaded(after.assignments)
  const relevantRemainingCapacityAfterHours = round2(sumRemainingCapacity(after.assignments))

  const affectedActiveCommitments = allAssignments.filter((a) => memberIds.has(a.resourceId) && a.status !== 'cancelled' && a.requestId !== requestId).length

  return {
    relevantDepartments,
    overloadedResourcesBefore,
    overloadedResourcesAfter,
    relevantRemainingCapacityBeforeHours,
    relevantRemainingCapacityAfterHours,
    affectedActiveCommitments,
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
