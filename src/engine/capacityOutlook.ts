// Capacity Outlook — "where is organizational delivery capability becoming
// constrained?" This module deliberately does NOT compute per-skill demand
// by assigning a request's full effort to every required skill (a 300h
// request needing 3 skills is not 900h of demand). See the methodology
// note on calculateCapabilityPressure below for the approach actually used
// and why it stays additive and defensible.

import type { RequestSkill, Skill, WorkRequest } from '@/types/database'
import type { EngineAssignment, EngineAvailability, EngineResource, OrgSettings, UtilizationStatus } from './types'
import { calculateCapacity, utilizationStatus } from './capacity'
import { isActiveRequest } from './dashboardMetrics'

/** Resources at/above this level count as "senior" for a capability's competency mix — mirrors the "high complexity" seniority floor teamBuilder already enforces. */
export const SENIOR_LEVEL_THRESHOLD = 3

export interface CapabilityPressureRow {
  skillId: string
  skillName: string
  /** Open requests (within the horizon) that require this capability. */
  requestCount: number
  /**
   * Estimated hours of demand attributable to this capability — an
   * estimate, not confirmed skill-level effort tracking. See methodology
   * note below.
   */
  estimatedDemandHours: number
  /** Sum of available capacity (over the horizon) among active resources who hold this skill. Not floored at zero: a pool already overcommitted should show that. */
  availableCapacityHours: number
  qualifiedResourceCount: number
  seniorQualifiedResourceCount: number
  /** estimatedDemandHours / availableCapacityHours, treated like a "pool utilization" for status banding. Capped for display when capacity is zero/negative. */
  pressureRatio: number
  status: UtilizationStatus
  affectedRequestIds: string[]
}

const UNBOUNDED_PRESSURE_DISPLAY_RATIO = 999

/**
 * METHODOLOGY — Estimated Demand Hours
 * -------------------------------------
 * The schema has no explicit effort-by-skill breakdown (`request_skills`
 * carries `importance_weight`, not hours). Assigning a request's full
 * `estimated_effort_hours` to every one of its required skills would
 * fabricate demand (a 300h request needing 3 skills would appear to create
 * 900h of organizational demand).
 *
 * Instead, each request's effort is split ACROSS ITS OWN required skills in
 * proportion to that skill's `importance_weight` for that request — the
 * same weighting field `teamBuilder`'s scoring already uses for this
 * request/skill pair. This keeps the estimate:
 *   - additive: summing a request's contribution back across its own
 *     required skills always equals its `estimated_effort_hours`, so one
 *     request can never manufacture extra org-wide demand just because it
 *     needs several capabilities.
 *   - deterministic and documented: same inputs always produce the same
 *     split, and the UI must label this figure as an estimate (see the
 *     Capacity Outlook page's info tooltip).
 *
 * This is still an ESTIMATE, not measured per-skill effort — it answers
 * "how much of this request's effort is attributable to this capability,
 * assuming effort roughly follows the recorded importance weighting,"
 * not "this capability required exactly N hours."
 *
 * METHODOLOGY — Available Capacity
 * ---------------------------------
 * Available capacity per capability sums `calculateCapacity(...)` (the
 * same capacity engine used everywhere else) over every ACTIVE resource
 * who holds that skill, for the selected horizon. A resource who holds
 * multiple capabilities is counted independently in each capability's
 * pool — capacity figures across different capability rows are therefore
 * NOT simply additive (the same person cannot give 100% of their time to
 * two capabilities at once). This is a standard, documented simplification
 * for a per-capability supply view; a fully shared-capacity allocation
 * across capabilities would require a multi-request optimizer, which is
 * explicitly out of scope.
 *
 * METHODOLOGY — Pressure Status
 * -------------------------------
 * `pressureRatio` treats demand/capacity like a pool utilization rate and
 * reuses the ORGANIZATION'S OWN configured target/overload thresholds
 * (`utilizationStatus`) for banding — never a hardcoded generic cutoff.
 */
export function calculateCapabilityPressure(params: {
  requests: Pick<WorkRequest, 'id' | 'estimated_effort_hours' | 'requested_deadline' | 'status'>[]
  requestSkills: Pick<RequestSkill, 'request_id' | 'skill_id' | 'importance_weight'>[]
  skills: Pick<Skill, 'id' | 'name' | 'active'>[]
  resources: EngineResource[]
  assignments: EngineAssignment[]
  availability: EngineAvailability[]
  org: OrgSettings
  today: Date
  horizonDays: number
}): CapabilityPressureRow[] {
  const { requests, requestSkills, skills, resources, assignments, availability, org, today, horizonDays } = params
  const horizonEnd = new Date(today)
  horizonEnd.setDate(horizonEnd.getDate() + horizonDays)

  // Demand in scope = open requests whose deadline falls inside the
  // horizon (the work must be delivered within this window). Draft,
  // completed, and cancelled requests are excluded via isActiveRequest.
  const inHorizonIds = new Set(
    requests
      .filter((r) => isActiveRequest(r.status))
      .filter((r) => {
        const d = new Date(r.requested_deadline)
        return d >= today && d <= horizonEnd
      })
      .map((r) => r.id),
  )
  const requestById = new Map(requests.map((r) => [r.id, r]))

  // Defensive de-dup: a duplicate resource row (or a duplicate
  // request_skill row) must never double-count capacity or demand.
  const uniqueResources = Array.from(new Map(resources.map((r) => [r.id, r])).values()).filter((r) => r.active)

  const skillsByRequest = new Map<string, { skillId: string; importanceWeight: number }[]>()
  const seenPairs = new Set<string>()
  for (const rs of requestSkills) {
    if (!inHorizonIds.has(rs.request_id)) continue
    const pairKey = `${rs.request_id}::${rs.skill_id}`
    if (seenPairs.has(pairKey)) continue // duplicate request_skill row guard
    seenPairs.add(pairKey)
    const list = skillsByRequest.get(rs.request_id) ?? []
    list.push({ skillId: rs.skill_id, importanceWeight: rs.importance_weight > 0 ? rs.importance_weight : 1 })
    skillsByRequest.set(rs.request_id, list)
  }

  const demandBySkill = new Map<string, number>()
  const requestsBySkill = new Map<string, Set<string>>()
  for (const [requestId, reqSkills] of skillsByRequest) {
    const request = requestById.get(requestId)
    if (!request) continue
    const totalWeight = reqSkills.reduce((sum, s) => sum + s.importanceWeight, 0) || 1
    for (const { skillId, importanceWeight } of reqSkills) {
      const share = (request.estimated_effort_hours * importanceWeight) / totalWeight
      demandBySkill.set(skillId, (demandBySkill.get(skillId) ?? 0) + share)
      const set = requestsBySkill.get(skillId) ?? new Set<string>()
      set.add(requestId)
      requestsBySkill.set(skillId, set)
    }
  }

  return skills
    .filter((s) => s.active)
    .map((skill): CapabilityPressureRow => {
      const qualified = uniqueResources.filter((r) => r.skills.some((rs) => rs.skillId === skill.id))
      const availableCapacityHours = qualified.reduce((sum, r) => {
        const capacity = calculateCapacity({ resource: r, org, assignments, availability, rangeStart: today, rangeEnd: horizonEnd })
        return sum + capacity.availableCapacityHours
      }, 0)
      const estimatedDemandHours = round2(demandBySkill.get(skill.id) ?? 0)
      const seniorQualifiedResourceCount = qualified.filter((r) => r.seniorityLevel >= SENIOR_LEVEL_THRESHOLD).length

      const rawRatio = availableCapacityHours > 0 ? estimatedDemandHours / availableCapacityHours : estimatedDemandHours > 0 ? Infinity : 0
      const displayRatio = Number.isFinite(rawRatio) ? round2(rawRatio) : UNBOUNDED_PRESSURE_DISPLAY_RATIO
      const status = utilizationStatus(Number.isFinite(rawRatio) ? rawRatio : UNBOUNDED_PRESSURE_DISPLAY_RATIO, org)

      return {
        skillId: skill.id,
        skillName: skill.name,
        requestCount: requestsBySkill.get(skill.id)?.size ?? 0,
        estimatedDemandHours,
        availableCapacityHours: round2(availableCapacityHours),
        qualifiedResourceCount: qualified.length,
        seniorQualifiedResourceCount,
        pressureRatio: displayRatio,
        status,
        affectedRequestIds: Array.from(requestsBySkill.get(skill.id) ?? []),
      }
    })
    .sort((a, b) => b.pressureRatio - a.pressureRatio)
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
