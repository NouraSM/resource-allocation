import type { PriorityLevel, RiskSeverity } from './types'

export const RISK_WEIGHTS = {
  deadline: 0.35,
  capacity: 0.3,
  skillGap: 0.2,
  dependency: 0.1,
  assignment: 0.05,
} as const

export interface DeliveryRiskInputs {
  /** 0-100, higher is better (from deadlineFeasibility engine) */
  deadlineFeasibilityScore: number
  /** 0-100, higher is better (team/resource capacity score) */
  capacityScore: number
  /** 0-100, higher is better (weighted skill match) */
  skillCoverageScore: number
  /** 0-100, already a risk-style value from the request (dependency_impact) */
  dependencyImpact: number
  /** 0-100, higher is better: how much of the required effort is actually covered by the team */
  assignmentCoverageScore: number
}

export interface DeliveryRiskResult {
  score: number // 0-100, higher = worse
  severity: RiskSeverity
  breakdown: { deadlineRisk: number; capacityRisk: number; skillGapRisk: number; dependencyRisk: number; assignmentRisk: number }
}

export function calculateDeliveryRisk(inputs: DeliveryRiskInputs): DeliveryRiskResult {
  const deadlineRisk = 100 - inputs.deadlineFeasibilityScore
  const capacityRisk = 100 - inputs.capacityScore
  const skillGapRisk = 100 - inputs.skillCoverageScore
  const dependencyRisk = inputs.dependencyImpact
  const assignmentRisk = 100 - inputs.assignmentCoverageScore

  const score =
    deadlineRisk * RISK_WEIGHTS.deadline +
    capacityRisk * RISK_WEIGHTS.capacity +
    skillGapRisk * RISK_WEIGHTS.skillGap +
    dependencyRisk * RISK_WEIGHTS.dependency +
    assignmentRisk * RISK_WEIGHTS.assignment

  const clamped = Math.round(Math.min(100, Math.max(0, score)) * 100) / 100

  return {
    score: clamped,
    severity: riskSeverityFromScore(clamped),
    breakdown: {
      deadlineRisk: round2(deadlineRisk),
      capacityRisk: round2(capacityRisk),
      skillGapRisk: round2(skillGapRisk),
      dependencyRisk: round2(dependencyRisk),
      assignmentRisk: round2(assignmentRisk),
    },
  }
}

export function riskSeverityFromScore(score: number): RiskSeverity {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 30) return 'medium'
  return 'low'
}

/** Critical-priority requests with High/Critical delivery risk surface on the Command Center. */
export function requiresExecutiveAttention(priorityLevel: PriorityLevel, riskSeverity: RiskSeverity): boolean {
  return priorityLevel === 'critical' && (riskSeverity === 'high' || riskSeverity === 'critical')
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
