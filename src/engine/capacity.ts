import type { EngineAssignment, EngineAvailability, EngineResource, OrgSettings, UtilizationStatus } from './types'
import { workingDaysBetween } from './urgency'

export interface CapacityBreakdown {
  grossCapacityHours: number
  assignedHours: number
  unavailableHours: number
  availableCapacityHours: number
  utilization: number // committed hours / gross capacity, unbounded (>1 = overallocated)
}

function overlapWorkingDays(rangeStart: Date, rangeEnd: Date, spanStart: Date, spanEnd: Date, workingDays: number[]): number {
  const start = spanStart > rangeStart ? spanStart : rangeStart
  const end = spanEnd < rangeEnd ? spanEnd : rangeEnd
  if (end <= start) return 0
  // +1 day so the overlap is inclusive of the end date, matching how the
  // total span below is measured for pro-rating assignment hours.
  return workingDaysBetween(start, addDays(end, 1), workingDays)
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Gross capacity for a resource over [rangeStart, rangeEnd), prorated by the org's working week. */
export function calculateGrossCapacity(resource: EngineResource, org: OrgSettings, rangeStart: Date, rangeEnd: Date): number {
  const workingDaysPerWeek = Math.max(1, org.workingDays.length)
  const dailyHours = resource.weeklyCapacityHours / workingDaysPerWeek
  const daysInRange = workingDaysBetween(rangeStart, rangeEnd, org.workingDays)
  return round2(dailyHours * daysInRange)
}

/** Hours lost to leave/training/other reduced-availability days inside the range. */
export function calculateUnavailableHours(
  resource: EngineResource,
  org: OrgSettings,
  availability: EngineAvailability[],
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const workingDaysPerWeek = Math.max(1, org.workingDays.length)
  const standardDailyHours = resource.weeklyCapacityHours / workingDaysPerWeek
  let total = 0
  for (const a of availability) {
    if (a.resourceId !== resource.id) continue
    const date = new Date(a.date)
    if (date < rangeStart || date >= rangeEnd) continue
    total += Math.max(0, standardDailyHours - a.availableHours)
  }
  return round2(total)
}

/** Hours committed to existing assignments inside the range, prorated across each assignment's span. */
export function calculateAssignedHours(
  resource: EngineResource,
  org: OrgSettings,
  assignments: EngineAssignment[],
  rangeStart: Date,
  rangeEnd: Date,
  excludeAssignmentIds: string[] = [],
): number {
  let total = 0
  for (const a of assignments) {
    if (a.resourceId !== resource.id) continue
    if (a.status === 'cancelled') continue
    if (excludeAssignmentIds.includes(a.id)) continue
    const spanStart = new Date(a.startDate)
    const spanEnd = new Date(a.endDate)
    const totalSpanDays = Math.max(1, workingDaysBetween(spanStart, addDays(spanEnd, 1), org.workingDays))
    const overlapDays = overlapWorkingDays(rangeStart, rangeEnd, spanStart, spanEnd, org.workingDays)
    if (overlapDays <= 0) continue
    total += (a.allocatedHours * overlapDays) / totalSpanDays
  }
  return round2(total)
}

export function calculateUtilization(committedHours: number, grossCapacityHours: number): number {
  if (grossCapacityHours <= 0) return committedHours > 0 ? 5 : 0 // no capacity at all but hours committed -> treat as extreme overload (500%)
  return committedHours / grossCapacityHours
}

export interface CapacityParams {
  resource: EngineResource
  org: OrgSettings
  assignments: EngineAssignment[]
  availability: EngineAvailability[]
  rangeStart: Date
  rangeEnd: Date
  excludeAssignmentIds?: string[]
}

/** available_capacity = gross_capacity - assigned_hours - unavailable_hours */
export function calculateCapacity(params: CapacityParams): CapacityBreakdown {
  const { resource, org, assignments, availability, rangeStart, rangeEnd, excludeAssignmentIds } = params
  const grossCapacityHours = calculateGrossCapacity(resource, org, rangeStart, rangeEnd)
  const assignedHours = calculateAssignedHours(resource, org, assignments, rangeStart, rangeEnd, excludeAssignmentIds)
  const unavailableHours = calculateUnavailableHours(resource, org, availability, rangeStart, rangeEnd)
  const availableCapacityHours = round2(grossCapacityHours - assignedHours - unavailableHours)
  const utilization = calculateUtilization(assignedHours, grossCapacityHours)
  return { grossCapacityHours, assignedHours, unavailableHours, availableCapacityHours, utilization }
}

/**
 * Utilization bands. The 50% "underutilized" floor is fixed; the
 * healthy/high/overloaded boundaries follow the organization's configured
 * target_utilization and overload_threshold so thresholds stay tunable
 * per tenant as the spec requires.
 */
export function utilizationStatus(utilization: number, org: Pick<OrgSettings, 'targetUtilization' | 'overloadThreshold'>): UtilizationStatus {
  if (utilization < 0.5) return 'underutilized'
  if (utilization <= org.targetUtilization) return 'healthy'
  if (utilization <= org.overloadThreshold) return 'high'
  if (utilization <= 1) return 'overloaded'
  return 'critical'
}

/** capacity_score = min(available_hours / requested_hours, 1) * 100, div-by-zero safe. */
export function calculateCapacityScore(availableHours: number, requestedHours: number): number {
  if (requestedHours <= 0) return 100
  if (availableHours <= 0) return 0
  return round2(Math.min(availableHours / requestedHours, 1) * 100)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export type { UtilizationStatus }
