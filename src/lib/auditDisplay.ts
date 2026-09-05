// Presentation-only humanization for the Audit Log. Storage always keeps the
// raw action/entity_type/field data exactly as written by logAudit() — this
// module only decides how those values are labeled on screen. Anything not
// found in the maps below falls back to a generic humanize (snake_case or
// camelCase -> Title Case), never a bare internal identifier.

function genericHumanize(raw: string): string {
  const withSpaces = raw
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
  return withSpaces
    .split(/\s+/)
    .map((word) => (word.length ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ')
}

const ACTION_LABELS: Record<string, string> = {
  urgency_override: 'Urgency Override',
  allocation_rejected: 'Allocation Rejected',
  allocation_modified: 'Allocation Modified',
  allocation_approved: 'Allocation Approved',
  request_status_changed: 'Request Status Changed',
  request_created: 'Request Created',
  resource_updated: 'Resource Updated',
  resource_created: 'Resource Created',
  organization_updated: 'Organization Updated',
  user_role_changed: 'User Role Changed',
  user_active_changed: 'User Active Status Changed',
  csv_import: 'CSV Import',
}

export function humanizeAction(action: string): string {
  return ACTION_LABELS[action] ?? genericHumanize(action)
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  organization: 'Organization',
  profile: 'Profile',
  resource: 'Resource',
  resources: 'Resource',
  work_request: 'Work Request',
  work_requests: 'Work Request',
  assignment: 'Assignment',
  assignments: 'Assignment',
  skill: 'Skill',
  skills: 'Skill',
  resource_skills: 'Resource Skill',
}

export function humanizeEntityType(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] ?? genericHumanize(entityType)
}

const FIELD_LABELS: Record<string, string> = {
  urgency_override: 'Urgency Override',
  members: 'Team Members',
  teamScore: 'Team Score',
  status: 'Status',
  title: 'Title',
  priority_level: 'Priority',
  priority_score: 'Priority Score',
  full_name: 'Name',
  name: 'Name',
  department: 'Department',
  weekly_capacity_hours: 'Weekly Capacity',
  active: 'Active',
  job_title: 'Job Title',
  seniority_level: 'Seniority Level',
  location: 'Location',
  target_utilization: 'Target Utilization',
  overload_threshold: 'Overload Threshold',
  role: 'Role',
  rowCount: 'Rows Imported',
  template: 'Template',
}

// Fields whose numeric value is a 0-1 fraction that reads better as a percent.
const PERCENT_FIELDS = new Set(['target_utilization', 'overload_threshold'])

function humanizeFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (key === 'status' || key === 'priority_level') {
    // These reuse the exact same i18n label the rest of the app already shows
    // for this value (status.*/priority.* keys) when it's a recognized one;
    // otherwise fall back to a humanized version of the raw value.
    return genericHumanize(String(value))
  }
  if (key === 'active' && typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (PERCENT_FIELDS.has(key) && typeof value === 'number') return `${Math.round(value * 100)}%`
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Renders an old_value/new_value JSON blob as a human-readable "Label: value" list. */
export function summarizeAuditValue(value: Record<string, unknown> | null): string {
  if (!value) return '—'
  return Object.entries(value)
    .map(([key, v]) => `${FIELD_LABELS[key] ?? genericHumanize(key)}: ${humanizeFieldValue(key, v)}`)
    .join(', ')
}
