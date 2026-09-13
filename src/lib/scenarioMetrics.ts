// Shared formatting for the 0-100 normalized scenario metrics
// (teamBuilder.ts's teamScore/skillCoverageScore/capacityScore/
// deadlineFeasibilityScore/seniorityMixScore/continuityScore, and each
// candidate's skillFitScore). These are weighted/derived indices, not
// literal percentages of a single physical quantity — displayed
// consistently as "X / 100" everywhere they appear (Scenario Card,
// Compare Scenarios, Decision Brief) so the same number never reads as a
// percentage in one place and a bare integer in another.
export function formatScenarioScore(value: number): string {
  return `${Math.round(value)} / 100`
}
