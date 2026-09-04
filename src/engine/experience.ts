import type { EngineHistoricalProject } from './types'

export interface ExperienceContext {
  sector?: string | null
  projectType?: string | null
}

/**
 * V1 relevant-experience score: deterministic and transparent (no
 * embeddings). Rewards resources with a track record of comparable
 * assignments (matching sector and/or project type) and factors in how
 * well those engagements performed.
 */
export function calculateExperienceScore(history: EngineHistoricalProject[], context: ExperienceContext): number {
  if (history.length === 0) return 0

  const comparable = history.filter(
    (h) => (context.sector && h.sector === context.sector) || (context.projectType && h.projectType === context.projectType),
  )
  if (comparable.length === 0) return 0

  const exactMatches = comparable.filter((h) => h.sector === context.sector && h.projectType === context.projectType)
  const volumeScore = (Math.min(comparable.length, 4) / 4) * 45 + (Math.min(exactMatches.length, 2) / 2) * 15

  const scored = comparable.filter((h) => typeof h.performanceScore === 'number')
  const avgPerformance = scored.length
    ? scored.reduce((sum, h) => sum + (h.performanceScore as number), 0) / scored.length
    : 70 // neutral assumption when performance wasn't recorded
  const performanceScore = (avgPerformance / 100) * 40

  return round2(Math.min(100, volumeScore + performanceScore))
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
