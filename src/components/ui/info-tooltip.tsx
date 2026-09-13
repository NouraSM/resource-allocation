import { useState } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Small, click-to-toggle explanation popover — used wherever a number on
 * screen is a defensible estimate/derived value rather than a stored fact,
 * so the methodology is one click away instead of buried in documentation.
 */
export function InfoTooltip({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <span className={cn('relative inline-flex', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-label="More information"
        className="text-slate-300 transition-colors hover:text-slate-500"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span className="absolute start-0 top-5 z-20 w-72 rounded-[var(--radius-control)] border border-slate-200 bg-white p-3 text-xs font-normal leading-relaxed text-slate-600 shadow-[var(--shadow-elevated)]">
          {text}
        </span>
      )}
    </span>
  )
}
