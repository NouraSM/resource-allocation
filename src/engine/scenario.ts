import type { EngineAssignment, EngineAvailability, EngineResource, OrgSettings } from './types'
import { calculateCapacity, calculateCapacityScore, utilizationStatus } from './capacity'
import type { UtilizationStatus } from './capacity'
import { calculateDeadlineFeasibility } from './deadlineFeasibility'
import { calculateDeliveryRisk } from './risk'
import type { RiskSeverity } from './types'

// What-if Engine — every change is applied to an in-memory copy of
// assignments/availability and never touches the caller's arrays or the
// database. Nothing here is persisted until the user explicitly approves.

export type WhatIfChange =
  | { kind: 'assign_resource'; assignment: EngineAssignment }
  | { kind: 'remove_resource'; assignmentId: string }
  | { kind: 'change_allocation'; assignmentId: string; allocationPercentage: number; allocatedHours: number }
  | { kind: 'move_resource'; assignmentId: string; newRequestId: string }
  | { kind: 'simulate_absence'; resourceId: string; startDate: string; endDate: string; reason: string }

export interface WhatIfInput {
  assignments: EngineAssignment[]
  availability: EngineAvailability[]
  changes: WhatIfChange[]
}

export interface WhatIfOutput {
  assignments: EngineAssignment[]
  availability: EngineAvailability[]
}

/** Pure reducer: returns brand-new arrays, the originals are left untouched. */
export function applyWhatIfChanges(input: WhatIfInput): WhatIfOutput {
  let assignments = [...input.assignments]
  let availability = [...input.availability]

  for (const change of input.changes) {
    switch (change.kind) {
      case 'assign_resource':
        assignments = [...assignments, change.assignment]
        break
      case 'remove_resource':
        assignments = assignments.filter((a) => a.id !== change.assignmentId)
        break
      case 'change_allocation':
        assignments = assignments.map((a) =>
          a.id === change.assignmentId ? { ...a, allocationPercentage: change.allocationPercentage, allocatedHours: change.allocatedHours } : a,
        )
        break
      case 'move_resource':
        assignments = assignments.map((a) => (a.id === change.assignmentId ? { ...a, requestId: change.newRequestId } : a))
        break
      case 'simulate_absence': {
        const start = new Date(change.startDate)
        const end = new Date(change.endDate)
        const extra: EngineAvailability[] = []
        const cursor = new Date(start)
        while (cursor <= end) {
          extra.push({
            resourceId: change.resourceId,
            date: cursor.toISOString().slice(0, 10),
            availableHours: 0,
            availabilityType: 'leave',
          })
          cursor.setDate(cursor.getDate() + 1)
        }
        availability = [...availability, ...extra]
        break
      }
    }
  }

  return { assignments, availability }
}

export interface UtilizationSnapshot {
  resourceId: string
  fullName: string
  utilization: number
  status: UtilizationStatus
  availableCapacityHours: number
}

export function snapshotResourceUtilization(
  resource: EngineResource,
  org: OrgSettings,
  assignments: EngineAssignment[],
  availability: EngineAvailability[],
  rangeStart: Date,
  rangeEnd: Date,
): UtilizationSnapshot {
  const capacity = calculateCapacity({ resource, org, assignments, availability, rangeStart, rangeEnd })
  return {
    resourceId: resource.id,
    fullName: resource.fullName,
    utilization: Math.round(capacity.utilization * 1000) / 10,
    status: utilizationStatus(capacity.utilization, org),
    availableCapacityHours: capacity.availableCapacityHours,
  }
}

export interface RequestRiskSnapshot {
  requestId: string
  requiredHours: number
  allocatedHours: number
  deadlineFeasibilityScore: number
  riskScore: number
  riskSeverity: RiskSeverity
}

export function snapshotRequestRisk(params: {
  requestId: string
  requiredHours: number
  deadline: Date
  today: Date
  assignments: EngineAssignment[]
  resources: EngineResource[]
  org: OrgSettings
  availability: EngineAvailability[]
  skillCoverageScore?: number
  dependencyImpact?: number
}): RequestRiskSnapshot {
  const { requestId, requiredHours, deadline, today, assignments, resources, org, availability } = params
  const requestAssignments = assignments.filter((a) => a.requestId === requestId && a.status !== 'cancelled')
  const allocatedHours = requestAssignments.reduce((sum, a) => sum + a.allocatedHours, 0)

  const availableHoursAcrossTeam = requestAssignments.reduce((sum, a) => {
    const resource = resources.find((r) => r.id === a.resourceId)
    if (!resource) return sum
    const capacity = calculateCapacity({ resource, org, assignments, availability, rangeStart: today, rangeEnd: deadline })
    return sum + capacity.availableCapacityHours
  }, 0)

  const deadlineResult = calculateDeadlineFeasibility({
    today,
    deadline,
    requiredHours,
    availableHoursBeforeDeadline: availableHoursAcrossTeam,
    workingDays: org.workingDays,
  })
  const capacityScore = calculateCapacityScore(allocatedHours, requiredHours)
  const risk = calculateDeliveryRisk({
    deadlineFeasibilityScore: deadlineResult.score,
    capacityScore,
    skillCoverageScore: params.skillCoverageScore ?? 80,
    dependencyImpact: params.dependencyImpact ?? 30,
    assignmentCoverageScore: capacityScore,
  })

  return {
    requestId,
    requiredHours,
    allocatedHours,
    deadlineFeasibilityScore: deadlineResult.score,
    riskScore: risk.score,
    riskSeverity: risk.severity,
  }
}

export interface WhatIfComparison<T> {
  before: T
  after: T
}

export function compareUtilization(
  resource: EngineResource,
  org: OrgSettings,
  before: { assignments: EngineAssignment[]; availability: EngineAvailability[] },
  after: { assignments: EngineAssignment[]; availability: EngineAvailability[] },
  rangeStart: Date,
  rangeEnd: Date,
): WhatIfComparison<UtilizationSnapshot> {
  return {
    before: snapshotResourceUtilization(resource, org, before.assignments, before.availability, rangeStart, rangeEnd),
    after: snapshotResourceUtilization(resource, org, after.assignments, after.availability, rangeStart, rangeEnd),
  }
}

/** Simple, explainable recommendation text for the what-if panel. */
export function recommendationFromComparisons(resourceComparisons: WhatIfComparison<UtilizationSnapshot>[], requestComparisons: WhatIfComparison<RequestRiskSnapshot>[]): string {
  const overloaded = resourceComparisons.filter((c) => c.after.utilization > 100)
  const worsenedRequests = requestComparisons.filter((c) => severityRank(c.after.riskSeverity) > severityRank(c.before.riskSeverity))

  if (overloaded.length === 0 && worsenedRequests.length === 0) {
    return 'This change looks safe to approve: no resource would exceed 100% utilization and no in-flight request risk increases.'
  }

  const parts: string[] = ['Do not approve as-is.']
  if (overloaded.length) {
    parts.push(`${overloaded.map((c) => `${c.after.fullName} would reach ${c.after.utilization}% utilization`).join(', ')}.`)
  }
  if (worsenedRequests.length) {
    parts.push(`${worsenedRequests.length} request(s) would move to a higher delivery-risk band.`)
  }
  return parts.join(' ')
}

function severityRank(severity: RiskSeverity): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[severity]
}
