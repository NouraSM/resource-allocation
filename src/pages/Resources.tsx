import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { LoadingState } from '@/components/ui/states'

export function Resources() {
  const { t } = useI18n()
  return (
    <AppShell title={t('resources.title')} subtitle={t('resources.subtitle')}>
      <LoadingState />
    </AppShell>
  )
}
