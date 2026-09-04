import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Full RLS enforcement can only be verified against a live Postgres instance
// (see supabase/migrations for the policies and the README for how to run
// `supabase test db` against them). This is a fast, dependency-free static
// guard that fails the build if a tenant table's Row Level Security policy
// is ever removed or stops scoping by organization_id.

const MIGRATIONS_DIR = path.resolve(__dirname, '../../../supabase/migrations')

const TENANT_TABLES = [
  'organizations',
  'profiles',
  'resources',
  'skills',
  'resource_skills',
  'historical_projects',
  'resource_availability',
  'work_requests',
  'request_skills',
  'deliverables',
  'assignments',
  'risks',
  'allocation_recommendations',
  'scenario_runs',
  'audit_logs',
  'notifications',
]

function readAllMigrations(): string {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
  return files.map((f) => readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')).join('\n')
}

describe('tenant isolation (static schema guard)', () => {
  const sql = readAllMigrations()

  it.each(TENANT_TABLES)('enables Row Level Security on %s', (table) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  })

  it.each(TENANT_TABLES)('scopes at least one policy on %s by organization', (table) => {
    // every table must be referenced by current_org_id() somewhere in its
    // policy definitions (either directly or via the org column check)
    const tableSectionMatch = sql.match(new RegExp(`create policy [a-z_]+ on public\\.${table}[\\s\\S]*?;`, 'gi'))
    expect(tableSectionMatch).not.toBeNull()
    const scoped = tableSectionMatch!.some((policy) => /current_org_id\(\)/.test(policy))
    expect(scoped).toBe(true)
  })

  it('never grants a blanket USING (true) policy that would leak cross-tenant data', () => {
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i)
  })
})
