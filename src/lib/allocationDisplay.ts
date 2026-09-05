// Presentation-only helpers for the Allocation Workspace. Nothing here
// computes a score, ranks a candidate, or decides feasibility — that all
// stays in src/engine/teamBuilder.ts. This module only decides how the
// engine's existing output gets labeled and summarized on screen.

import type { CandidateEvaluation, TeamScenario } from '@/engine/teamBuilder'

export type ScenarioBadgeKey = 'recommended' | 'bestSkillFit' | 'bestWorkloadBalance' | 'bestDeadlineFeasibility'

/**
 * Assigns evidence-based badges to each scenario based on metrics the
 * engine already computed. A scenario can earn more than one badge if it
 * genuinely leads more than one metric; scenarios with no team members are
 * never badged. A badge (including "recommended") is only awarded when
 * exactly one scenario uniquely holds the top value for that metric — a tie
 * means no scenario gets it, rather than every tied scenario getting it.
 * This does not change any score or which scenario the engine ranked
 * highest; it only decides how that result gets labeled on screen.
 */
export function deriveScenarioBadges(scenarios: TeamScenario[], recommendedScenarioNumber: number): Record<number, ScenarioBadgeKey[]> {
  const result: Record<number, ScenarioBadgeKey[]> = {}
  const withMembers = scenarios.filter((s) => s.members.length > 0)

  if (withMembers.length === 0) {
    scenarios.forEach((s) => (result[s.scenarioNumber] = []))
    return result
  }

  const isUniqueMax = (values: number[], value: number) => value === Math.max(...values) && values.filter((v) => v === value).length === 1

  const teamScores = withMembers.map((s) => s.teamScore)
  const skillScores = withMembers.map((s) => s.skillCoverageScore)
  const balanceScores = withMembers.map((s) => s.loadBalanceScore)
  const deadlineScores = withMembers.map((s) => s.deadlineFeasibilityScore)

  for (const s of scenarios) {
    if (s.members.length === 0) {
      result[s.scenarioNumber] = []
      continue
    }
    const badges: ScenarioBadgeKey[] = []
    if (s.scenarioNumber === recommendedScenarioNumber && isUniqueMax(teamScores, s.teamScore)) badges.push('recommended')
    if (isUniqueMax(skillScores, s.skillCoverageScore)) badges.push('bestSkillFit')
    if (isUniqueMax(balanceScores, s.loadBalanceScore)) badges.push('bestWorkloadBalance')
    if (isUniqueMax(deadlineScores, s.deadlineFeasibilityScore)) badges.push('bestDeadlineFeasibility')
    result[s.scenarioNumber] = badges
  }
  return result
}

/** True when two or more scenarios (with members) share the highest teamScore — no synthetic tie-breaker is introduced. */
export function hasTiedTopScenarios(scenarios: TeamScenario[]): boolean {
  const withMembers = scenarios.filter((s) => s.members.length > 0)
  if (withMembers.length < 2) return false
  const max = Math.max(...withMembers.map((s) => s.teamScore))
  return withMembers.filter((s) => s.teamScore === max).length > 1
}

/** Requests already allocated/in-progress/at-risk get a "review" CTA instead of "generate". */
const REVIEW_STATUSES = ['allocated', 'in_progress', 'at_risk'] as const

export function isReviewStatus(status: string): boolean {
  return (REVIEW_STATUSES as readonly string[]).includes(status)
}

export interface ReasonSummary {
  reason: string
  count: number
}

/** Groups the engine's own per-candidate infeasibility reasons by exact text, most common first. */
export function summarizeInfeasibleReasons(notFeasible: CandidateEvaluation[], limit = 5): ReasonSummary[] {
  const counts = new Map<string, number>()
  for (const c of notFeasible) {
    for (const reason of c.infeasibleReasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1)
    }
  }
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
