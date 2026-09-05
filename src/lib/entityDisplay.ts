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

/**
 * The canonical list of senior government bodies allowed as a Requesting
 * Entity. `value` is the exact string stored in the database (and matched
 * against by entityShortLabel/filters elsewhere) — never localized. `labelKey`
 * is the i18n key for the visible option label only. This is the single
 * source of truth for that list; do not duplicate it elsewhere.
 */
export interface SeniorEntity {
  value: string
  labelKey: string
}

export const SENIOR_ENTITIES: SeniorEntity[] = [
  { value: 'Council of Ministers', labelKey: 'entities.councilOfMinisters' },
  { value: 'Shura Council', labelKey: 'entities.shuraCouncil' },
  { value: 'Council of Economic and Development Affairs', labelKey: 'entities.ceda' },
  { value: 'Council of Political and Security Affairs', labelKey: 'entities.cpsa' },
  { value: 'General Secretariat of the Council of Ministers', labelKey: 'entities.gscm' },
  { value: 'Royal Court', labelKey: 'entities.royalCourt' },
]
