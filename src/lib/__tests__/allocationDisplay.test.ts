import { describe, expect, it } from 'vitest'
import { isReviewStatus } from '@/lib/allocationDisplay'

// isReviewStatus is the single source of truth the Allocation Queue and
// Allocation Workspace both reuse to decide whether selecting a request's
// explicit allocation action should read "Generate Scenarios" (new/never
// allocated) or "Review / Re-optimize" (already allocated/in-flight) — the
// distinction the request-inspection vs. explicit-action navigation fix
// depends on. This locks that business rule in place independent of the UI.
describe('isReviewStatus', () => {
  it('treats allocated/in_progress/at_risk requests as review-worthy', () => {
    expect(isReviewStatus('allocated')).toBe(true)
    expect(isReviewStatus('in_progress')).toBe(true)
    expect(isReviewStatus('at_risk')).toBe(true)
  })

  it('treats everything else as a fresh "generate" case', () => {
    expect(isReviewStatus('draft')).toBe(false)
    expect(isReviewStatus('submitted')).toBe(false)
    expect(isReviewStatus('under_review')).toBe(false)
    expect(isReviewStatus('ready_for_allocation')).toBe(false)
    expect(isReviewStatus('completed')).toBe(false)
    expect(isReviewStatus('cancelled')).toBe(false)
  })
})
