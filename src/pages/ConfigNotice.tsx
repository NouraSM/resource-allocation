import { DatabaseZap } from 'lucide-react'

export function ConfigNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <DatabaseZap className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-semibold text-slate-900">RA Copilot needs Supabase credentials</h1>
        <p className="mt-2 text-sm text-slate-500">
          Copy <code className="rounded bg-slate-100 px-1 py-0.5">.env.example</code> to{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">.env</code>, fill in{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code>, run the migrations in{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">supabase/migrations</code>, then restart the dev server. See the README for the full setup guide.
        </p>
      </div>
    </div>
  )
}
