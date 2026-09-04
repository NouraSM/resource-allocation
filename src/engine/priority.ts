import type { PriorityLevel } from './types'

// Priority Engine — a fixed, explainable weighted sum. All inputs must
// already be normalized to 0-100 by the caller (see the *_MAP constants
// below for how the New Request form's simple controls become numbers).

export const PRIORITY_WEIGHTS = {
  urgency: 0.3,
  strategicImportance: 0.25,
  executiveSponsorship: 0.15,
  regulatoryImportance: 0.15,
  publicImpact: 0.1,
  dependencyImpact: 0.05,
} as const

export interface PriorityInputs {
  urgencyScore: number
  strategicImportance: number
  executiveSponsorship: number
  regulatoryImportance: number
  publicImpact: number
  dependencyImpact: number
}

export function calculatePriorityScore(inputs: PriorityInputs): number {
  const raw =
    inputs.urgencyScore * PRIORITY_WEIGHTS.urgency +
    inputs.strategicImportance * PRIORITY_WEIGHTS.strategicImportance +
    inputs.executiveSponsorship * PRIORITY_WEIGHTS.executiveSponsorship +
    inputs.regulatoryImportance * PRIORITY_WEIGHTS.regulatoryImportance +
    inputs.publicImpact * PRIORITY_WEIGHTS.publicImpact +
    inputs.dependencyImpact * PRIORITY_WEIGHTS.dependencyImpact
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100
}

export function priorityLevelFromScore(score: number): PriorityLevel {
  if (score >= 85) return 'critical'
  if (score >= 70) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

export interface PriorityBreakdownItem {
  key: keyof PriorityInputs
  label: string
  weight: number
  value: number
  contribution: number
}

/** Ordered breakdown used to explain "why is this Critical/High/…" in the UI. */
export function priorityBreakdown(inputs: PriorityInputs): PriorityBreakdownItem[] {
  const labels: Record<keyof PriorityInputs, string> = {
    urgencyScore: 'Urgency',
    strategicImportance: 'Strategic Importance',
    executiveSponsorship: 'Executive Sponsorship',
    regulatoryImportance: 'Regulatory Importance',
    publicImpact: 'Public Impact',
    dependencyImpact: 'Dependency Impact',
  }
  const weightKeys: Record<keyof PriorityInputs, keyof typeof PRIORITY_WEIGHTS> = {
    urgencyScore: 'urgency',
    strategicImportance: 'strategicImportance',
    executiveSponsorship: 'executiveSponsorship',
    regulatoryImportance: 'regulatoryImportance',
    publicImpact: 'publicImpact',
    dependencyImpact: 'dependencyImpact',
  }
  return (Object.keys(inputs) as (keyof PriorityInputs)[]).map((key) => {
    const weight = PRIORITY_WEIGHTS[weightKeys[key]]
    const value = inputs[key]
    return { key, label: labels[key], weight, value, contribution: Math.round(value * weight * 100) / 100 }
  })
}

// ---------------------------------------------------------------------------
// UI selection -> numeric score mappings (New Request "Business Importance")
// ---------------------------------------------------------------------------
export const STRATEGIC_IMPORTANCE_SCORE = { low: 20, medium: 50, high: 75, critical: 95 } as const
export const YES_NO_SCORE = { yes: 90, no: 10 } as const
export const PUBLIC_IMPACT_SCORE = { low: 20, medium: 50, high: 80 } as const
export const DEPENDENCY_SCORE = { none: 10, some: 50, critical: 90 } as const

export type StrategicImportanceOption = keyof typeof STRATEGIC_IMPORTANCE_SCORE
export type YesNoOption = keyof typeof YES_NO_SCORE
export type PublicImpactOption = keyof typeof PUBLIC_IMPACT_SCORE
export type DependencyOption = keyof typeof DEPENDENCY_SCORE
