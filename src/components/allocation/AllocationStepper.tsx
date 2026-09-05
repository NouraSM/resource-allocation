import { Check } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type AllocationStep = 'request' | 'scenarios' | 'compare' | 'approve'

const STEPS: AllocationStep[] = ['request', 'scenarios', 'compare', 'approve']
const LABEL_KEYS: Record<AllocationStep, string> = {
  request: 'allocationStepper.request',
  scenarios: 'allocationStepper.scenarios',
  compare: 'allocationStepper.compare',
  approve: 'allocationStepper.approve',
}

/** Purely visual workflow indicator — reflects page state, decides nothing. */
export function AllocationStepper({ current }: { current: AllocationStep }) {
  const { t } = useI18n()
  const currentIndex = STEPS.indexOf(current)

  return (
    <div className="mb-4 flex items-center">
      {STEPS.map((step, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        return (
          <div key={step} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                  done && 'border-status-healthy bg-status-healthy text-white',
                  active && !done && 'border-brand-600 text-brand-700',
                  !done && !active && 'border-slate-200 text-slate-300',
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn('text-xs font-medium', active ? 'text-brand-700' : done ? 'text-slate-600' : 'text-slate-400')}>
                {t(LABEL_KEYS[step])}
              </span>
            </div>
            {i < STEPS.length - 1 && <div className={cn('mx-3 h-px flex-1', done ? 'bg-status-healthy' : 'bg-slate-200')} />}
          </div>
        )
      })}
    </div>
  )
}
