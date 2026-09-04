import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { LoadingState } from '@/components/ui/states'

export function AuditLog() {
  const { t } = useI18n()
  return (
    <AppShell title={t('auditLog.title')}>
      <LoadingState />
    </AppShell>
  )
}
