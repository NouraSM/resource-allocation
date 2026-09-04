import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { LoadingState } from '@/components/ui/states'

export function Notifications() {
  const { t } = useI18n()
  return (
    <AppShell title={t('notifications.title')}>
      <LoadingState />
    </AppShell>
  )
}
