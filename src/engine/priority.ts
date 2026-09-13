import type { PriorityLevel } from './types'

// Priority Engine — a fixed, explainable weighted sum. All inputs must
// already be normalized to 0-100 by the caller (see the *_MAP constants
// below for how the New Request form's simple controls become numbers).
//
// Simplified model: urgency, regulatory/hard-deadline pressure, and
// dependency impact are the operationally defensible drivers of "what
// should we work on next." Strategic Importance, Executive Sponsorship,
// and Public Impact were removed as self-reported, easily-inflated inputs
// that do not reflect an objective delivery constraint — see the
// Settings > Decision Policy panel for how this is presented to users.

export const PRIORITY_WEIGHTS = {
  urgency: 0.5,
  regulatoryImportance: 0.3,
  dependencyImpact: 0.2,
} as const

export interface PriorityInputs {
  urgencyScore: number
  regulatoryImportance: number
  dependencyImpact: number
}

export function calculatePriorityScore(inputs: PriorityInputs): number {
  const raw =
    inputs.urgencyScore * PRIORITY_WEIGHTS.urgency +
    inputs.regulatoryImportance * PRIORITY_WEIGHTS.regulatoryImportance +
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
    regulatoryImportance: 'Regulatory / Hard Deadline',
    dependencyImpact: 'Dependency Impact',
  }
  const weightKeys: Record<keyof PriorityInputs, keyof typeof PRIORITY_WEIGHTS> = {
    urgencyScore: 'urgency',
    regulatoryImportance: 'regulatoryImportance',
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
export const YES_NO_SCORE = { yes: 90, no: 10 } as const
export const DEPENDENCY_SCORE = { none: 10, some: 50, critical: 90 } as const

export type YesNoOption = keyof typeof YES_NO_SCORE
export type DependencyOption = keyof typeof DEPENDENCY_SCORE
