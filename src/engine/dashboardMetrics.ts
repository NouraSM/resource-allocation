import type { Assignment, PriorityLevel, Resource, RiskSeverity, WorkRequest } from '@/types/database'
import type { EngineAssignment, EngineAvailability, EngineResource, OrgSettings } from './types'
import { calculateCapacity, utilizationStatus } from './capacity'
import { requiresExecutiveAttention } from './risk'

export interface WeeklyCapacityPoint {
  weekStart: string
  utilization: number
  availableCapacityHours: number
  grossCapacityHours: number
}

/** A rolling weekly capacity/utilization series, used for "upcoming capacity" charts on a resource profile. */
export function weeklyCapacitySeries(
  resource: EngineResource,
  org: OrgSettings,
  assignments: EngineAssignment[],
  availability: EngineAvailability[],
  from: Date,
  weeks = 6,
): WeeklyCapacityPoint[] {
  const points: WeeklyCapacityPoint[] = []
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(from)
    weekStart.setDate(weekStart.getDate() + i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const capacity = calculateCapacity({ resource, org, assignments, availability, rangeStart: weekStart, rangeEnd: weekEnd })
    points.push({
      weekStart: weekStart.toISOString().slice(0, 10),
      utilization: Math.round(capacity.utilization * 1000) / 10,
      availableCapacityHours: Math.round(capacity.availableCapacityHours),
      grossCapacityHours: Math.round(capacity.grossCapacityHours),
    })
  }
  return points
}

const OPEN_STATUSES = ['submitted', 'under_review', 'ready_for_allocation', 'allocated', 'in_progress', 'at_risk'] as const
const UNALLOCATED_STATUSES = ['submitted', 'under_review', 'ready_for_allocation'] as const

export function isActiveRequest(status: string): boolean {
  return (OPEN_STATUSES as readonly string[]).includes(status)
}

export function isUnallocated(request: WorkRequest, assignments: Assignment[]): boolean {
  const hasActiveAssignment = assignments.some((a) => a.request_id === request.id && a.status !== 'cancelled')
  return (UNALLOCATED_STATUSES as readonly string[]).includes(request.status) && !hasActiveAssignment
}

export interface ResourceUtilizationRow {
  resource: Resource
  utilization: number
  status: ReturnType<typeof utilizationStatus>
  availableCapacityHours: number
}

/** Utilization for every active resource over [rangeStart, rangeEnd). */
export function computeResourceUtilizations(
  resources: EngineResource[],
  rawResources: Resource[],
  org: OrgSettings,
  assignments: EngineAssignment[],
  availability: EngineAvailability[],
  rangeStart: Date,
  rangeEnd: Date,
): ResourceUtilizationRow[] {
  return resources
    .filter((r) => r.active)
    .map((r) => {
      const raw = rawResources.find((row) => row.id === r.id)!
      const capacity = calculateCapacity({ resource: r, org, assignments, availability, rangeStart, rangeEnd })
      return { resource: raw, utilization: capacity.utilization, status: utilizationStatus(capacity.utilization, org), availableCapacityHours: capacity.availableCapacityHours }
    })
}

export interface RequestRiskInfo {
  requestId: string
  severity: RiskSeverity | null
}

/** Derives a display severity per request from its active risk rows (max severity wins). */
export function deriveRequestRiskSeverities(requests: WorkRequest[], risks: { request_id: string; severity: RiskSeverity }[]): Map<string, RiskSeverity> {
  const rank: Record<RiskSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 }
  const map = new Map<string, RiskSeverity>()
  for (const risk of risks) {
    const current = map.get(risk.request_id)
    if (!current || rank[risk.severity] > rank[current]) map.set(risk.request_id, risk.severity)
  }
  // requests explicitly marked at_risk without a recorded risk row still surface as "high"
  for (const r of requests) {
    if (r.status === 'at_risk' && !map.has(r.id)) map.set(r.id, 'high')
  }
  return map
}

export function commandCenterKpis(params: {
  requests: WorkRequest[]
  assignments: Assignment[]
  resourceUtilizations: ResourceUtilizationRow[]
  availableCapacityNext2Weeks: number
}) {
  const { requests, assignments, resourceUtilizations, availableCapacityNext2Weeks } = params
  const active = requests.filter((r) => isActiveRequest(r.status))
  const critical = requests.filter((r) => r.priority_level === 'critical' && isActiveRequest(r.status))
  const atRisk = requests.filter((r) => r.status === 'at_risk')
  const unallocated = requests.filter((r) => isUnallocated(r, assignments))
  const overloaded = resourceUtilizations.filter((r) => r.status === 'overloaded' || r.status === 'critical')
  const avgUtilization = resourceUtilizations.length ? resourceUtilizations.reduce((s, r) => s + r.utilization, 0) / resourceUtilizations.length : 0

  return {
    activeRequests: active.length,
    criticalRequests: critical.length,
    atRiskRequests: atRisk.length,
    unallocatedRequests: unallocated.length,
    teamUtilization: avgUtilization,
    overloadedResources: overloaded.length,
    availableCapacityNext2Weeks,
  }
}

export function executiveAttentionRequests(requests: WorkRequest[], severityByRequest: Map<string, RiskSeverity>): WorkRequest[] {
  return requests.filter((r) => {
    const severity = severityByRequest.get(r.id)
    return severity ? requiresExecutiveAttention(r.priority_level as PriorityLevel, severity) : false
  })
}

export function upcomingDeadlines(requests: WorkRequest[], today: Date, horizonDays = 30): WorkRequest[] {
  const horizon = new Date(today)
  horizon.setDate(horizon.getDate() + horizonDays)
  return requests
    .filter((r) => isActiveRequest(r.status))
    .filter((r) => {
      const d = new Date(r.requested_deadline)
      return d >= today && d <= horizon
    })
    .sort((a, b) => new Date(a.requested_deadline).getTime() - new Date(b.requested_deadline).getTime())
}

export interface DepartmentCapacityRow {
  department: string
  avgUtilization: number
  headcount: number
}

export function departmentCapacity(resourceUtilizations: ResourceUtilizationRow[]): DepartmentCapacityRow[] {
  const byDept = new Map<string, ResourceUtilizationRow[]>()
  resourceUtilizations.forEach((row) => {
    const list = byDept.get(row.resource.department) ?? []
    list.push(row)
    byDept.set(row.resource.department, list)
  })
  return Array.from(byDept.entries())
    .map(([department, rows]) => ({
      department,
      avgUtilization: rows.reduce((s, r) => s + r.utilization, 0) / rows.length,
      headcount: rows.length,
    }))
    .sort((a, b) => b.avgUtilization - a.avgUtilization)
}

export interface PriorityCapacityRow {
  priority: PriorityLevel
  backlogHours: number
  requestCount: number
}

/** Backlog effort by priority level, for the "priority vs capacity" visualization. */
export function priorityBacklog(requests: WorkRequest[], assignments: Assignment[]): PriorityCapacityRow[] {
  const levels: PriorityLevel[] = ['critical', 'high', 'medium', 'low']
  return levels.map((priority) => {
    const items = requests.filter((r) => r.priority_level === priority && isActiveRequest(r.status))
    const backlogHours = items.reduce((sum, r) => {
      const allocated = assignments.filter((a) => a.request_id === r.id && a.status !== 'cancelled').reduce((s, a) => s + a.allocated_hours, 0)
      return sum + Math.max(0, r.estimated_effort_hours - allocated)
    }, 0)
    return { priority, backlogHours: Math.round(backlogHours), requestCount: items.length }
  })
}
