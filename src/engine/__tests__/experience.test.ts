import { describe, expect, it } from 'vitest'
import { calculateExperienceScore } from '@/engine/experience'

describe('experience engine', () => {
  it('returns 0 when a resource has no historical projects', () => {
    expect(calculateExperienceScore([], { sector: 'Healthcare', projectType: 'Strategy' })).toBe(0)
  })

  it('returns 0 when no history matches the sector or project type', () => {
    const history = [{ resourceId: 'r1', sector: 'Energy', projectType: 'Benchmarking', performanceScore: 90 }]
    expect(calculateExperienceScore(history, { sector: 'Healthcare', projectType: 'Strategy' })).toBe(0)
  })

  it('scores higher with more comparable engagements and strong performance', () => {
    const light = [{ resourceId: 'r1', sector: 'Healthcare', projectType: 'Strategy', performanceScore: 70 }]
    const heavy = [
      { resourceId: 'r1', sector: 'Healthcare', projectType: 'Strategy', performanceScore: 95 },
      { resourceId: 'r1', sector: 'Healthcare', projectType: 'Strategy', performanceScore: 92 },
      { resourceId: 'r1', sector: 'Healthcare', projectType: 'Benchmarking', performanceScore: 90 },
    ]
    const lightScore = calculateExperienceScore(light, { sector: 'Healthcare', projectType: 'Strategy' })
    const heavyScore = calculateExperienceScore(heavy, { sector: 'Healthcare', projectType: 'Strategy' })
    expect(heavyScore).toBeGreaterThan(lightScore)
    expect(heavyScore).toBeLessThanOrEqual(100)
  })
})
