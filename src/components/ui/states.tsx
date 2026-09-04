import type { ReactNode } from 'react'
import { Loader2, AlertTriangle, Inbox } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export function LoadingState({ label }: { label?: string }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p className="text-sm">{label ?? t('common.loading')}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-status-critical-bg bg-status-critical-bg/40 py-16 text-status-critical">
      <AlertTriangle className="h-6 w-6" />
      <p className="text-sm font-medium">{message ?? t('common.error')}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs font-semibold underline underline-offset-2">
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string
  body?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-25 py-16 text-center">
      <div className="mb-1 text-slate-300">{icon ?? <Inbox className="h-8 w-8" />}</div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {body && <p className="max-w-sm text-xs text-slate-500">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
