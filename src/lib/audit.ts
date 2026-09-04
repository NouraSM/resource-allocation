import { supabase } from '@/lib/supabase'

export interface AuditEntry {
  organizationId: string
  userId: string
  action: string
  entityType: string
  entityId: string
  oldValue?: unknown
  newValue?: unknown
  reason?: string | null
}

/** Every write path that changes something a reviewer might ask "why" about should call this. */
export async function logAudit(entry: AuditEntry) {
  await supabase.from('audit_logs').insert({
    organization_id: entry.organizationId,
    user_id: entry.userId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    old_value: (entry.oldValue ?? null) as never,
    new_value: (entry.newValue ?? null) as never,
    reason: entry.reason ?? null,
  })
}
