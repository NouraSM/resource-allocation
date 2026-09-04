import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { LoadingState } from '@/components/ui/states'

export function WorkRequests() {
  const { t } = useI18n()
  return (
    <AppShell title={t('requests.title')} subtitle={t('requests.subtitle')}>
      <LoadingState />
    </AppShell>
  )
}
