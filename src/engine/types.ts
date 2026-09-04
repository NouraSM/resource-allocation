// Shared, framework-free types for the deterministic decision engines.
// Pages/hooks map Supabase rows into these shapes; the engines never touch
// Supabase directly so they stay pure and unit-testable.

export interface OrgSettings {
  workingDays: number[] // 0=Sunday .. 6=Saturday
  dailyWorkHours: number
  weeklyWorkHours: number
  targetUtilization: number
  overloadThreshold: number
}

export interface EngineResourceSkill {
  skillId: string
  proficiency: number // 1-5
}

export interface EngineResource {
  id: string
  fullName: string
  department: string
  seniorityLevel: number
  weeklyCapacityHours: number
  active: boolean
  skills: EngineResourceSkill[]
}

export interface EngineRequiredSkill {
  skillId: string
  requiredLevel: number
  importanceWeight: number
  mandatory: boolean
}

export interface EngineAssignment {
  id: string
  resourceId: string
  requestId: string
  allocationPercentage: number
  allocatedHours: number
  startDate: string
  endDate: string
  status: 'proposed' | 'active' | 'completed' | 'cancelled'
}

export interface EngineAvailability {
  resourceId: string
  date: string
  availableHours: number
  availabilityType: string
}

export interface EngineHistoricalProject {
  resourceId: string
  sector: string
  projectType: string
  performanceScore: number | null
}

export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical'
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'
export type UtilizationStatus = 'underutilized' | 'healthy' | 'high' | 'overloaded' | 'critical'
