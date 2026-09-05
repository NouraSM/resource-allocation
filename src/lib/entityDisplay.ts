// Presentation-only abbreviations for the senior requesting-entity names.
// The full database value is never altered — only how it's displayed in
// space-constrained table cells.
const ENTITY_ABBREVIATIONS: Record<string, string> = {
  'Council of Economic and Development Affairs': 'CEDA',
  'Council of Political and Security Affairs': 'CPSA',
  'General Secretariat of the Council of Ministers': 'GSCM',
}

export function entityShortLabel(fullName: string): string {
  return ENTITY_ABBREVIATIONS[fullName] ?? fullName
}
