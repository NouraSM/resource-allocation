import { describe, expect, it } from 'vitest'
import { calculatePriorityScore, priorityLevelFromScore } from '@/engine/priority'

describe('priority engine', () => {
  it('weights urgency at 30%, strategic at 25%, exec sponsorship at 15%, regulatory at 15%, public impact at 10%, dependency at 5%', () => {
    const score = calculatePriorityScore({
      urgencyScore: 100,
      strategicImportance: 100,
      executiveSponsorship: 100,
      regulatoryImportance: 100,
      publicImpact: 100,
      dependencyImpact: 100,
    })
    expect(score).toBe(100)
  })

  it('computes a weighted sum for mixed inputs', () => {
    const score = calculatePriorityScore({
      urgencyScore: 90,
      strategicImportance: 95,
      executiveSponsorship: 90,
      regulatoryImportance: 10,
      publicImpact: 20,
      dependencyImpact: 10,
    })
    // 90*.3 + 95*.25 + 90*.15 + 10*.15 + 20*.10 + 10*.05
    expect(score).toBeCloseTo(27 + 23.75 + 13.5 + 1.5 + 2 + 0.5, 2)
  })

  it('clamps to 0-100', () => {
    const score = calculatePriorityScore({
      urgencyScore: 0,
      strategicImportance: 0,
      executiveSponsorship: 0,
      regulatoryImportance: 0,
      publicImpact: 0,
      dependencyImpact: 0,
    })
    expect(score).toBe(0)
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
