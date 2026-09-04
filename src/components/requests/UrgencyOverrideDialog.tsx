import { useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'

export function UrgencyOverrideDialog({
  open,
  onClose,
  currentScore,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  currentScore: number
  onSubmit: (value: number, reason: string) => void
}) {
  const [value, setValue] = useState(currentScore)
  const [reason, setReason] = useState('')

  return (
    <Dialog open={open} onClose={onClose} title="Override Urgency Score">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Computed urgency is {currentScore}. Overrides are captured with a required reason and recorded in the audit log.
        </p>
        <div>
          <Label htmlFor="urgency-value">New urgency score (0-100)</Label>
          <Input
            id="urgency-value"
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="urgency-reason">Reason (required)</Label>
          <Textarea id="urgency-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!reason.trim()} onClick={() => onSubmit(value, reason.trim())}>
            Save Override
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
