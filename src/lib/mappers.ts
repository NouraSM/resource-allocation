// Converts Supabase row shapes into the framework-free types the engines
// operate on. Keeping this in one place means the engines never need to
// know about the database, and pages never duplicate this shaping logic.

import type { Assignment, Organization, Resource, ResourceAvailability, ResourceSkill, HistoricalProject } from '@/types/database'
import type { EngineAssignment, EngineAvailability, EngineHistoricalProject, EngineResource, OrgSettings } from '@/engine/types'

export function mapOrgSettings(org: Organization): OrgSettings {
  const workingDays = Array.isArray(org.working_days) ? (org.working_days as number[]) : [0, 1, 2, 3, 4]
  return {
    workingDays,
    dailyWorkHours: org.daily_work_hours,
    weeklyWorkHours: org.weekly_work_hours,
    targetUtilization: org.target_utilization,
    overloadThreshold: org.overload_threshold,
  }
}

export function mapEngineResource(resource: Resource, skills: ResourceSkill[]): EngineResource {
  return {
    id: resource.id,
    fullName: resource.full_name,
    department: resource.department,
    seniorityLevel: resource.seniority_level,
    weeklyCapacityHours: resource.weekly_capacity_hours,
    active: resource.active,
    skills: skills.filter((s) => s.resource_id === resource.id).map((s) => ({ skillId: s.skill_id, proficiency: s.proficiency })),
  }
}

export function mapEngineAssignment(a: Assignment): EngineAssignment {
  return {
    id: a.id,
    resourceId: a.resource_id,
    requestId: a.request_id,
    allocationPercentage: a.allocation_percentage,
    allocatedHours: a.allocated_hours,
    startDate: a.start_date,
    endDate: a.end_date,
    status: a.status,
  }
}

export function mapEngineAvailability(a: ResourceAvailability): EngineAvailability {
  return { resourceId: a.resource_id, date: a.date, availableHours: a.available_hours, availabilityType: a.availability_type }
}

export function mapEngineHistoricalProject(h: HistoricalProject): EngineHistoricalProject {
  return { resourceId: h.resource_id, sector: h.sector, projectType: h.project_type, performanceScore: h.performance_score }
}
