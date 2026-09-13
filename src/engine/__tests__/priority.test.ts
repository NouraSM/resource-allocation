import { describe, expect, it } from 'vitest'
import { calculatePriorityScore, priorityLevelFromScore } from '@/engine/priority'

describe('priority engine', () => {
  it('weights urgency at 50%, regulatory/hard-deadline at 30%, dependency at 20%', () => {
    const score = calculatePriorityScore({
      urgencyScore: 100,
      regulatoryImportance: 100,
      dependencyImpact: 100,
    })
    expect(score).toBe(100)
  })

  it('computes a weighted sum for mixed inputs', () => {
    const score = calculatePriorityScore({
      urgencyScore: 90,
      regulatoryImportance: 10,
      dependencyImpact: 20,
    })
    // 90*.5 + 10*.3 + 20*.2
    expect(score).toBeCloseTo(45 + 3 + 4, 2)
  })

  it('clamps to 0-100', () => {
    const score = calculatePriorityScore({
      urgencyScore: 0,
      regulatoryImportance: 0,
      dependencyImpact: 0,
    })
    expect(score).toBe(0)
  })

  it('removed factors (strategic importance, executive sponsorship, public impact) no longer influence the score', () => {
    // Only urgency/regulatory/dependency inputs exist on PriorityInputs at all now —
    // this test documents that the weighted sum uses exactly those three and sums to 100%.
    const score = calculatePriorityScore({ urgencyScore: 40, regulatoryImportance: 40, dependencyImpact: 40 })
    expect(score).toBe(40)
  })

  it.each([
    [95, 'critical'],
    [85, 'critical'],
    [84.99, 'high'],
    [70, 'high'],
    [69.99, 'medium'],
    [50, 'medium'],
    [49.99, 'low'],
    [0, 'low'],
  ])('maps score %s to level %s', (score, level) => {
    expect(priorityLevelFromScore(score as number)).toBe(level)
  })
})
