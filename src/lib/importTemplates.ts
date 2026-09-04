import { calculateUrgencyScore } from '@/engine/urgency'
import {
  DEPENDENCY_SCORE,
  PUBLIC_IMPACT_SCORE,
  STRATEGIC_IMPORTANCE_SCORE,
  YES_NO_SCORE,
  calculatePriorityScore,
  priorityLevelFromScore,
} from '@/engine/priority'
import type { DependencyOption, PublicImpactOption, StrategicImportanceOption, YesNoOption } from '@/engine/priority'
import type { OrgData } from '@/hooks/useOrgData'

export interface ImportRowResult {
  rowNumber: number
  raw: Record<string, string>
  errors: string[]
  insertRow: Record<string, unknown> | null
}

export interface ImportTemplate {
  key: string
  table: string
  columns: string[]
  validateAll: (rows: Record<string, string>[], org: OrgData, organizationId: string) => ImportRowResult[]
}

function num(value: string): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function requireField(row: Record<string, string>, field: string, errors: string[]): string {
  const value = row[field]?.trim() ?? ''
  if (!value) errors.push(`Missing required field "${field}"`)
  return value
}

export const skillsTemplate: ImportTemplate = {
  key: 'skills',
  table: 'skills',
  columns: ['name', 'name_ar', 'category'],
  validateAll: (rows, _org, organizationId) =>
    rows.map((raw, i) => {
      const errors: string[] = []
      const name = requireField(raw, 'name', errors)
      if (errors.length) return { rowNumber: i + 2, raw, errors, insertRow: null }
      return {
        rowNumber: i + 2,
        raw,
        errors,
        insertRow: { organization_id: organizationId, name, name_ar: raw.name_ar || null, category: raw.category || 'general' },
      }
    }),
}

export const resourcesTemplate: ImportTemplate = {
  key: 'resources',
  table: 'resources',
  columns: ['employee_code', 'full_name', 'job_title', 'department', 'seniority_level', 'weekly_capacity_hours', 'location'],
  validateAll: (rows, org, organizationId) => {
    const seenCodes = new Set<string>()
    return rows.map((raw, i) => {
      const errors: string[] = []
      const employeeCode = requireField(raw, 'employee_code', errors)
      const fullName = requireField(raw, 'full_name', errors)
      requireField(raw, 'job_title', errors)
      requireField(raw, 'department', errors)
      const seniority = num(raw.seniority_level ?? '')
      if (seniority === null || seniority < 1 || seniority > 5) errors.push('seniority_level must be a number between 1 and 5')
      const capacity = num(raw.weekly_capacity_hours ?? '')
      if (capacity === null || capacity <= 0) errors.push('weekly_capacity_hours must be a positive number')
      if (employeeCode && (seenCodes.has(employeeCode) || org.resources.some((r) => r.employee_code === employeeCode))) {
        errors.push(`employee_code "${employeeCode}" already exists`)
      }
      seenCodes.add(employeeCode)

      if (errors.length) return { rowNumber: i + 2, raw, errors, insertRow: null }
      return {
        rowNumber: i + 2,
        raw,
        errors,
        insertRow: {
          organization_id: organizationId,
          employee_code: employeeCode,
          full_name: fullName,
          job_title: raw.job_title,
          department: raw.department,
          seniority_level: seniority,
          weekly_capacity_hours: capacity,
          location: raw.location || null,
        },
      }
    })
  },
}

export const resourceSkillsTemplate: ImportTemplate = {
  key: 'resource_skills',
  table: 'resource_skills',
  columns: ['employee_code', 'skill_name', 'proficiency', 'years_experience'],
  validateAll: (rows, org, organizationId) =>
    rows.map((raw, i) => {
      const errors: string[] = []
      const employeeCode = requireField(raw, 'employee_code', errors)
      const skillName = requireField(raw, 'skill_name', errors)
      const proficiency = num(raw.proficiency ?? '')
      if (proficiency === null || proficiency < 1 || proficiency > 5) errors.push('proficiency must be a number between 1 and 5')

      const resource = org.resources.find((r) => r.employee_code === employeeCode)
      if (employeeCode && !resource) errors.push(`No resource found with employee_code "${employeeCode}"`)
      const skill = org.skills.find((s) => s.name.toLowerCase() === skillName.toLowerCase())
      if (skillName && !skill) errors.push(`No skill found named "${skillName}"`)

      if (errors.length || !resource || !skill) return { rowNumber: i + 2, raw, errors, insertRow: null }
      return {
        rowNumber: i + 2,
        raw,
        errors,
        insertRow: {
          organization_id: organizationId,
          resource_id: resource.id,
          skill_id: skill.id,
          proficiency,
          years_experience: num(raw.years_experience ?? '') ?? 0,
        },
      }
    }),
}

const STRATEGIC_OPTIONS = Object.keys(STRATEGIC_IMPORTANCE_SCORE) as StrategicImportanceOption[]
const YES_NO_OPTIONS = Object.keys(YES_NO_SCORE) as YesNoOption[]
const PUBLIC_OPTIONS = Object.keys(PUBLIC_IMPACT_SCORE) as PublicImpactOption[]
const DEPENDENCY_OPTIONS = Object.keys(DEPENDENCY_SCORE) as DependencyOption[]

export const workRequestsTemplate: ImportTemplate = {
  key: 'work_requests',
  table: 'work_requests',
  columns: [
    'title',
    'requesting_entity',
    'requester_name',
    'received_date',
    'requested_deadline',
    'strategic_importance',
    'executive_sponsored',
    'regulatory_deadline',
    'public_impact',
    'dependencies',
    'estimated_effort_hours',
    'complexity',
    'description',
  ],
  validateAll: (rows, org, organizationId) =>
    rows.map((raw, i) => {
      const errors: string[] = []
      const title = requireField(raw, 'title', errors)
      const entity = requireField(raw, 'requesting_entity', errors)
      const requester = requireField(raw, 'requester_name', errors)
      const deadline = requireField(raw, 'requested_deadline', errors)
      if (deadline && Number.isNaN(new Date(deadline).getTime())) errors.push('requested_deadline must be a valid date (YYYY-MM-DD)')

      const strategic = raw.strategic_importance?.trim().toLowerCase() as StrategicImportanceOption
      if (!STRATEGIC_OPTIONS.includes(strategic)) errors.push(`strategic_importance must be one of: ${STRATEGIC_OPTIONS.join(', ')}`)
      const execSponsored = raw.executive_sponsored?.trim().toLowerCase() as YesNoOption
      if (!YES_NO_OPTIONS.includes(execSponsored)) errors.push(`executive_sponsored must be one of: ${YES_NO_OPTIONS.join(', ')}`)
      const regulatory = raw.regulatory_deadline?.trim().toLowerCase() as YesNoOption
      if (!YES_NO_OPTIONS.includes(regulatory)) errors.push(`regulatory_deadline must be one of: ${YES_NO_OPTIONS.join(', ')}`)
      const publicImpact = raw.public_impact?.trim().toLowerCase() as PublicImpactOption
      if (!PUBLIC_OPTIONS.includes(publicImpact)) errors.push(`public_impact must be one of: ${PUBLIC_OPTIONS.join(', ')}`)
      const dependencies = raw.dependencies?.trim().toLowerCase() as DependencyOption
      if (!DEPENDENCY_OPTIONS.includes(dependencies)) errors.push(`dependencies must be one of: ${DEPENDENCY_OPTIONS.join(', ')}`)
      const effort = num(raw.estimated_effort_hours ?? '')
      if (effort === null || effort < 0) errors.push('estimated_effort_hours must be a non-negative number')

      if (errors.length) return { rowNumber: i + 2, raw, errors, insertRow: null }

      const today = new Date()
      const urgencyScore = calculateUrgencyScore(today, new Date(deadline), org.orgSettings.workingDays)
      const priorityScore = calculatePriorityScore({
        urgencyScore,
        strategicImportance: STRATEGIC_IMPORTANCE_SCORE[strategic],
        executiveSponsorship: YES_NO_SCORE[execSponsored],
        regulatoryImportance: YES_NO_SCORE[regulatory],
        publicImpact: PUBLIC_IMPACT_SCORE[publicImpact],
        dependencyImpact: DEPENDENCY_SCORE[dependencies],
      })

      return {
        rowNumber: i + 2,
        raw,
        errors,
        insertRow: {
          organization_id: organizationId,
          title,
          description: raw.description || '',
          requesting_entity: entity,
          requester_name: requester,
          received_date: raw.received_date || today.toISOString().slice(0, 10),
          requested_deadline: deadline,
          strategic_importance: STRATEGIC_IMPORTANCE_SCORE[strategic],
          executive_sponsorship: YES_NO_SCORE[execSponsored],
          regulatory_importance: YES_NO_SCORE[regulatory],
          public_impact: PUBLIC_IMPACT_SCORE[publicImpact],
          dependency_impact: DEPENDENCY_SCORE[dependencies],
          urgency_score: urgencyScore,
          priority_score: priorityScore,
          priority_level: priorityLevelFromScore(priorityScore),
          estimated_effort_hours: effort,
          complexity: raw.complexity || 'medium',
          status: 'submitted',
        },
      }
    }),
}

export const assignmentsTemplate: ImportTemplate = {
  key: 'assignments',
  table: 'assignments',
  columns: ['request_number', 'employee_code', 'assignment_role', 'allocation_percentage', 'allocated_hours', 'start_date', 'end_date'],
  validateAll: (rows, org, organizationId) =>
    rows.map((raw, i) => {
      const errors: string[] = []
      const requestNumber = requireField(raw, 'request_number', errors)
      const employeeCode = requireField(raw, 'employee_code', errors)
      const startDate = requireField(raw, 'start_date', errors)
      const endDate = requireField(raw, 'end_date', errors)
      const pct = num(raw.allocation_percentage ?? '')
      if (pct === null || pct <= 0 || pct > 100) errors.push('allocation_percentage must be a number between 1 and 100')
      const hours = num(raw.allocated_hours ?? '')
      if (hours === null || hours < 0) errors.push('allocated_hours must be a non-negative number')

      const request = org.requests.find((r) => r.request_number === requestNumber)
      if (requestNumber && !request) errors.push(`No request found with request_number "${requestNumber}"`)
      const resource = org.resources.find((r) => r.employee_code === employeeCode)
      if (employeeCode && !resource) errors.push(`No resource found with employee_code "${employeeCode}"`)

      if (errors.length || !request || !resource) return { rowNumber: i + 2, raw, errors, insertRow: null }
      return {
        rowNumber: i + 2,
        raw,
        errors,
        insertRow: {
          organization_id: organizationId,
          request_id: request.id,
          resource_id: resource.id,
          assignment_role: raw.assignment_role || 'contributor',
          allocation_percentage: pct,
          allocated_hours: hours,
          start_date: startDate,
          end_date: endDate,
          status: 'active',
        },
      }
    }),
}

export const importTemplates: ImportTemplate[] = [skillsTemplate, resourcesTemplate, resourceSkillsTemplate, workRequestsTemplate, assignmentsTemplate]
