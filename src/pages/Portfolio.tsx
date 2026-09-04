import { AppShell } from '@/components/layout/AppShell'
import { useI18n } from '@/lib/i18n'
import { LoadingState } from '@/components/ui/states'

export function Portfolio() {
  const { t } = useI18n()
  return (
    <AppShell title={t('portfolio.title')}>
      <LoadingState />
    </AppShell>
  )
}
