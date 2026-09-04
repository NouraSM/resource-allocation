import { useRef, useState } from 'react'
import { CheckCircle2, Upload, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { parseCsvToRecords, toCsv } from '@/lib/csv'
import { downloadCsv } from '@/lib/csv'
import type { ImportRowResult, ImportTemplate } from '@/lib/importTemplates'
import type { OrgData } from '@/hooks/useOrgData'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { useAuth } from '@/hooks/useAuth'

export function CsvImportPanel({ template, org, onImported }: { template: ImportTemplate; org: OrgData; onImported: () => void }) {
  const { profile } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [results, setResults] = useState<ImportRowResult[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState<number | null>(null)

  function handleFile(file: File) {
    setImportedCount(null)
    const reader = new FileReader()
    reader.onload = () => {
      const records = parseCsvToRecords(String(reader.result))
      if (!profile) return
      setResults(template.validateAll(records, org, profile.organization_id))
    }
    reader.readAsText(file)
  }

  const validRows = results?.filter((r) => r.insertRow) ?? []
  const invalidRows = results?.filter((r) => !r.insertRow) ?? []

  async function handleImport() {
    if (!validRows.length || !profile) return
    setImporting(true)
    const { error } = await supabase.from(template.table as never).insert(validRows.map((r) => r.insertRow) as never)
    if (!error) {
      await logAudit({
        organizationId: profile.organization_id,
        userId: profile.id,
        action: 'csv_import',
        entityType: template.table,
        entityId: profile.organization_id,
        newValue: { rowCount: validRows.length, template: template.key },
      })
      setImportedCount(validRows.length)
      setResults(null)
      onImported()
    }
    setImporting(false)
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">{template.key}.csv</p>
          <p className="text-xs text-slate-500">Columns: {template.columns.join(', ')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => downloadCsv(`${template.key}_template.csv`, toCsv([], template.columns))}>
            Template
          </Button>
          <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" /> Choose file
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      </div>

      {results && (
        <div className="space-y-2">
          <div className="flex gap-2 text-xs">
            <Badge tone="healthy">
              <CheckCircle2 className="h-3 w-3" /> {validRows.length} valid
            </Badge>
            <Badge tone="critical">
              <XCircle className="h-3 w-3" /> {invalidRows.length} invalid
            </Badge>
          </div>
          {invalidRows.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded border border-status-critical-bg text-xs">
              {invalidRows.map((r) => (
                <div key={r.rowNumber} className="border-b border-status-critical-bg/50 p-1.5">
                  <span className="font-medium text-status-critical">Row {r.rowNumber}:</span> {r.errors.join('; ')}
                </div>
              ))}
            </div>
          )}
          <Button size="sm" disabled={!validRows.length || importing} onClick={handleImport}>
            {importing ? 'Importing…' : `Import ${validRows.length} row(s)`}
          </Button>
        </div>
      )}
      {importedCount !== null && <p className="text-xs font-medium text-status-healthy">Imported {importedCount} row(s) successfully.</p>}
    </Card>
  )
}
