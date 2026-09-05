import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, Select } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'
import type { Resource } from '@/types/database'

export interface ResourceFormValues {
  employee_code: string
  full_name: string
  job_title: string
  department: string
  seniority_level: number
  weekly_capacity_hours: number
  location: string
  active: boolean
}

const EMPTY: ResourceFormValues = {
  employee_code: '',
  full_name: '',
  job_title: '',
  department: '',
  seniority_level: 3,
  weekly_capacity_hours: 40,
  location: '',
  active: true,
}

export function ResourceFormDialog({
  open,
  onClose,
  onSave,
  existing,
  departments,
}: {
  open: boolean
  onClose: () => void
  onSave: (values: ResourceFormValues) => Promise<void> | void
  existing?: Resource | null
  departments: string[]
}) {
  const { t } = useI18n()
  const [values, setValues] = useState<ResourceFormValues>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues(
      existing
        ? {
            employee_code: existing.employee_code,
            full_name: existing.full_name,
            job_title: existing.job_title,
            department: existing.department,
            seniority_level: existing.seniority_level,
            weekly_capacity_hours: existing.weekly_capacity_hours,
            location: existing.location ?? '',
            active: existing.active,
          }
        : EMPTY,
    )
  }, [open, existing])

  const canSave = values.employee_code.trim() && values.full_name.trim() && values.job_title.trim() && values.department.trim()

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    await onSave(values)
    setSaving(false)
  }

  return (
    <Dialog open={open} onClose={onClose} title={existing ? t('common.edit') : t('resources.createResource')}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="rf-code">Employee Code</Label>
          <Input id="rf-code" value={values.employee_code} disabled={!!existing} onChange={(e) => setValues((v) => ({ ...v, employee_code: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="rf-name">{t('common.name')}</Label>
          <Input id="rf-name" value={values.full_name} onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="rf-title">{t('resources.table.title')}</Label>
          <Input id="rf-title" value={values.job_title} onChange={(e) => setValues((v) => ({ ...v, job_title: e.target.value }))} />
        </div>
        <div>
          <Label htmlFor="rf-dept">{t('resources.table.department')}</Label>
          <Input id="rf-dept" list="rf-dept-options" value={values.department} onChange={(e) => setValues((v) => ({ ...v, department: e.target.value }))} />
          <datalist id="rf-dept-options">
            {departments.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="rf-seniority">Seniority (1-5)</Label>
          <Select id="rf-seniority" value={values.seniority_level} onChange={(e) => setValues((v) => ({ ...v, seniority_level: Number(e.target.value) }))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="rf-capacity">Weekly Capacity Hours</Label>
          <Input
            id="rf-capacity"
            type="number"
            min={1}
            value={values.weekly_capacity_hours}
            onChange={(e) => setValues((v) => ({ ...v, weekly_capacity_hours: Number(e.target.value) }))}
          />
        </div>
        <div>
          <Label htmlFor="rf-location">Location</Label>
          <Input id="rf-location" value={values.location} onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))} />
        </div>
        {existing && (
          <div>
            <Label htmlFor="rf-active">{t('common.status')}</Label>
            <Select id="rf-active" value={values.active ? 'active' : 'inactive'} onChange={(e) => setValues((v) => ({ ...v, active: e.target.value === 'active' }))}>
              <option value="active">{t('common.yes')}</option>
              <option value="inactive">{t('common.no')}</option>
            </Select>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button disabled={!canSave || saving} onClick={handleSave}>
          {saving ? t('common.loading') : existing ? t('common.save') : t('resources.createResource')}
        </Button>
      </div>
    </Dialog>
  )
}
