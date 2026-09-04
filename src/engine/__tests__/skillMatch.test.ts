import { describe, expect, it } from 'vitest'
import { calculateSkillMatch } from '@/engine/skillMatch'

describe('skill match engine', () => {
  it('caps a skill match at 100% when proficiency exceeds the requirement', () => {
    const result = calculateSkillMatch([{ skillId: 's1', requiredLevel: 4, importanceWeight: 1, mandatory: false }], [{ skillId: 's1', proficiency: 5 }])
    expect(result.details[0].matchPercent).toBe(100)
  })

  it('scores proportionally when proficiency is below the requirement', () => {
    const result = calculateSkillMatch([{ skillId: 's1', requiredLevel: 4, importanceWeight: 1, mandatory: false }], [{ skillId: 's1', proficiency: 3 }])
    expect(result.details[0].matchPercent).toBe(75)
  })

  it('scores a missing skill as 0%', () => {
    const result = calculateSkillMatch([{ skillId: 's1', requiredLevel: 4, importanceWeight: 1, mandatory: false }], [])
    expect(result.details[0].matchPercent).toBe(0)
    expect(result.details[0].missing).toBe(true)
  })

  it('flags a missing mandatory skill as a hard-filter gap', () => {
    const result = calculateSkillMatch([{ skillId: 's1', requiredLevel: 3, importanceWeight: 1, mandatory: true }], [])
    expect(result.hasMandatoryGap).toBe(true)
    expect(result.missingMandatorySkillIds).toEqual(['s1'])
  })

  it('computes a weighted average across multiple required skills', () => {
    const result = calculateSkillMatch(
      [
        { skillId: 's1', requiredLevel: 4, importanceWeight: 2, mandatory: true },
        { skillId: 's2', requiredLevel: 2, importanceWeight: 1, mandatory: false },
      ],
      [
        { skillId: 's1', proficiency: 4 }, // 100%
        { skillId: 's2', proficiency: 1 }, // 50%
      ],
    )
    // (100*2 + 50*1) / 3
    expect(result.score).toBeCloseTo(83.33, 1)
  })

  it('returns a perfect score when a request has no required skills', () => {
    expect(calculateSkillMatch([], []).score).toBe(100)
  })
})
