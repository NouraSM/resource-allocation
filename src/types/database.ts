// Hand-authored types mirroring the Postgres schema in supabase/migrations.
// Kept in sync manually; regenerate with `supabase gen types typescript` once
// the project is linked to a live Supabase instance.

export type UserRole = 'admin' | 'resource_manager' | 'consultant' | 'executive_viewer'

export type RequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'ready_for_allocation'
  | 'allocated'
  | 'in_progress'
  | 'at_risk'
  | 'completed'
  | 'cancelled'

export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical'
export type Complexity = 'low' | 'medium' | 'high' | 'very_high'
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'
export type AssignmentStatus = 'proposed' | 'active' | 'completed' | 'cancelled'
export type AvailabilityType =
  | 'leave'
  | 'training'
  | 'internal_commitment'
  | 'external_assignment'
  | 'manual_adjustment'
export type DeliverableStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed'
export type NotificationSeverity = 'info' | 'warning' | 'critical'

export interface Organization {
  id: string
  name: string
  name_ar: string | null
  timezone: string
  working_days: number[]
  daily_work_hours: number
  weekly_work_hours: number
  target_utilization: number
  overload_threshold: number
  created_at: string
}

export interface Profile {
  id: string
  organization_id: string
  full_name: string
  email: string
  role: UserRole
  resource_id: string | null
  active: boolean
  created_at: string
}

export interface Resource {
  id: string
  organization_id: string
  employee_code: string
  full_name: string
  full_name_ar: string | null
  job_title: string
  job_title_ar: string | null
  grade: string | null
  department: string
  seniority_level: number
  weekly_capacity_hours: number
  utilization_target: number
  active: boolean
  location: string | null
  manager_id: string | null
  created_at: string
}

export interface Skill {
  id: string
  organization_id: string
  name: string
  name_ar: string | null
  category: string
  active: boolean
}

export interface ResourceSkill {
  id: string
  organization_id: string
  resource_id: string
  skill_id: string
  proficiency: number
  years_experience: number
  verified: boolean
}

export interface WorkRequest {
  id: string
  organization_id: string
  request_number: string
  title: string
  title_ar: string | null
  description: string
  requesting_entity: string
  requester_name: string
  request_type: string | null
  received_date: string
  requested_deadline: string
  strategic_importance: number
  executive_sponsorship: number
  regulatory_importance: number
  public_impact: number
  dependency_impact: number
  urgency_score: number
  urgency_override: number | null
  urgency_override_reason: string | null
  priority_score: number
  priority_level: PriorityLevel
  estimated_effort_hours: number
  complexity: Complexity
  status: RequestStatus
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RequestSkill {
  id: string
  organization_id: string
  request_id: string
  skill_id: string
  required_level: number
  importance_weight: number
  mandatory: boolean
}

export interface Deliverable {
  id: string
  organization_id: string
  request_id: string
  title: string
  due_date: string | null
  estimated_hours: number | null
  status: DeliverableStatus
  owner_resource_id: string | null
}

export interface Assignment {
  id: string
  organization_id: string
  request_id: string
  resource_id: string
  assignment_role: string
  allocation_percentage: number
  allocated_hours: number
  start_date: string
  end_date: string
  status: AssignmentStatus
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export interface ResourceAvailability {
  id: string
  organization_id: string
  resource_id: string
  date: string
  available_hours: number
  reason: string | null
  availability_type: AvailabilityType
}

export interface HistoricalProject {
  id: string
  organization_id: string
  resource_id: string
  project_name: string
  sector: string
  project_type: string
  start_date: string
  end_date: string | null
  performance_score: number | null
}

export interface Risk {
  id: string
  organization_id: string
  request_id: string
  risk_type: string
  risk_score: number
  severity: RiskSeverity
  description: string
  active: boolean
  created_at: string
}

export interface AllocationRecommendation {
  id: string
  organization_id: string
  request_id: string
  scenario_number: number
  team_score: number
  skill_coverage_score: number
  capacity_score: number
  workload_balance_score: number
  seniority_score: number
  deadline_feasibility_score: number
  risk_score: number
  explanation: string
  recommendation_data: Record<string, unknown>
  created_at: string
}

export interface ScenarioRun {
  id: string
  organization_id: string
  created_by: string | null
  request_id: string | null
  scenario_name: string
  scenario_data: Record<string, unknown>
  scenario_result: Record<string, unknown>
  created_at: string
}

export interface AuditLog {
  id: string
  organization_id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  reason: string | null
  created_at: string
}

export interface Notification {
  id: string
  organization_id: string
  user_id: string | null
  notification_type: string
  severity: NotificationSeverity
  title: string
  message: string
  entity_type: string | null
  entity_id: string | null
  read: boolean
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      organizations: { Row: Organization }
      profiles: { Row: Profile }
      resources: { Row: Resource }
      skills: { Row: Skill }
      resource_skills: { Row: ResourceSkill }
      work_requests: { Row: WorkRequest }
      request_skills: { Row: RequestSkill }
      deliverables: { Row: Deliverable }
      assignments: { Row: Assignment }
      resource_availability: { Row: ResourceAvailability }
      historical_projects: { Row: HistoricalProject }
      risks: { Row: Risk }
      allocation_recommendations: { Row: AllocationRecommendation }
      scenario_runs: { Row: ScenarioRun }
      audit_logs: { Row: AuditLog }
      notifications: { Row: Notification }
    }
  }
}
