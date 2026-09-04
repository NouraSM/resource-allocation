import type { EngineRequiredSkill, EngineResourceSkill } from './types'

export interface SkillMatchDetail {
  skillId: string
  requiredLevel: number
  resourceProficiency: number
  matchPercent: number // 0-100, capped at 100
  mandatory: boolean
  missing: boolean
}

export interface SkillMatchResult {
  score: number // 0-100 weighted average across required skills
  details: SkillMatchDetail[]
  hasMandatoryGap: boolean
  missingMandatorySkillIds: string[]
}

/**
 * Weighted average of per-skill match percentage
 * (resource proficiency / required level, capped at 100%).
 * A missing mandatory skill is flagged for the hard-filter step but does
 * not itself throw — callers decide how to treat infeasible candidates.
 */
export function calculateSkillMatch(requiredSkills: EngineRequiredSkill[], resourceSkills: EngineResourceSkill[]): SkillMatchResult {
  if (requiredSkills.length === 0) {
    return { score: 100, details: [], hasMandatoryGap: false, missingMandatorySkillIds: [] }
  }

  const proficiencyBySkill = new Map(resourceSkills.map((s) => [s.skillId, s.proficiency]))
  const details: SkillMatchDetail[] = requiredSkills.map((req) => {
    const proficiency = proficiencyBySkill.get(req.skillId) ?? 0
    const matchPercent = req.requiredLevel > 0 ? Math.min(1, proficiency / req.requiredLevel) * 100 : 100
    return {
      skillId: req.skillId,
      requiredLevel: req.requiredLevel,
      resourceProficiency: proficiency,
      matchPercent: round2(matchPercent),
      mandatory: req.mandatory,
      missing: proficiency <= 0,
    }
  })

  const totalWeight = requiredSkills.reduce((sum, r) => sum + (r.importanceWeight || 1), 0) || 1
  const weightedScore = requiredSkills.reduce((sum, req, i) => sum + details[i].matchPercent * (req.importanceWeight || 1), 0) / totalWeight

  const missingMandatorySkillIds = details.filter((d) => d.mandatory && d.missing).map((d) => d.skillId)

  return {
    score: round2(weightedScore),
    details,
    hasMandatoryGap: missingMandatorySkillIds.length > 0,
    missingMandatorySkillIds,
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
