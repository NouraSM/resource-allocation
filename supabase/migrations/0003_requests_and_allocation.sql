-- RA Copilot: work_requests, request_skills, deliverables, assignments,
-- risks, allocation_recommendations, scenario_runs

create table if not exists public.work_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  request_number text not null,
  title text not null,
  title_ar text,
  description text not null default '',
  requesting_entity text not null,
  requester_name text not null,
  request_type text,
  received_date date not null default current_date,
  requested_deadline date not null,
  strategic_importance numeric not null default 0 check (strategic_importance between 0 and 100),
  executive_sponsorship numeric not null default 0 check (executive_sponsorship between 0 and 100),
  regulatory_importance numeric not null default 0 check (regulatory_importance between 0 and 100),
  public_impact numeric not null default 0 check (public_impact between 0 and 100),
  dependency_impact numeric not null default 0 check (dependency_impact between 0 and 100),
  urgency_score numeric not null default 0 check (urgency_score between 0 and 100),
  urgency_override numeric check (urgency_override between 0 and 100),
  urgency_override_reason text,
  priority_score numeric not null default 0 check (priority_score between 0 and 100),
  priority_level text not null default 'low' check (priority_level in ('low', 'medium', 'high', 'critical')),
  estimated_effort_hours numeric not null default 0,
  complexity text not null default 'medium' check (complexity in ('low', 'medium', 'high', 'very_high')),
  status text not null default 'draft' check (
    status in (
      'draft', 'submitted', 'under_review', 'ready_for_allocation',
      'allocated', 'in_progress', 'at_risk', 'completed', 'cancelled'
    )
  ),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, request_number)
);

create table if not exists public.request_skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  request_id uuid not null references public.work_requests (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  required_level integer not null check (required_level between 1 and 5),
  importance_weight numeric not null default 1,
  mandatory boolean not null default false,
  unique (request_id, skill_id)
);

create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  request_id uuid not null references public.work_requests (id) on delete cascade,
  title text not null,
  due_date date,
  estimated_hours numeric,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed', 'delayed')),
  owner_resource_id uuid references public.resources (id) on delete set null
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  request_id uuid not null references public.work_requests (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  assignment_role text not null default 'contributor',
  allocation_percentage numeric not null check (allocation_percentage > 0 and allocation_percentage <= 100),
  allocated_hours numeric not null default 0,
  start_date date not null,
  end_date date not null,
  status text not null default 'proposed' check (status in ('proposed', 'active', 'completed', 'cancelled')),
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  request_id uuid not null references public.work_requests (id) on delete cascade,
  risk_type text not null,
  risk_score numeric not null check (risk_score between 0 and 100),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.allocation_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  request_id uuid not null references public.work_requests (id) on delete cascade,
  scenario_number integer not null check (scenario_number between 1 and 3),
  team_score numeric not null,
  skill_coverage_score numeric not null,
  capacity_score numeric not null,
  workload_balance_score numeric not null,
  seniority_score numeric not null,
  deadline_feasibility_score numeric not null,
  risk_score numeric not null,
  explanation text not null default '',
  recommendation_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.scenario_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  request_id uuid references public.work_requests (id) on delete cascade,
  scenario_name text not null,
  scenario_data jsonb not null default '{}'::jsonb,
  scenario_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_requests_org on public.work_requests (organization_id);
create index if not exists idx_work_requests_status on public.work_requests (organization_id, status);
create index if not exists idx_work_requests_deadline on public.work_requests (organization_id, requested_deadline);
create index if not exists idx_request_skills_request on public.request_skills (request_id);
create index if not exists idx_deliverables_request on public.deliverables (request_id);
create index if not exists idx_assignments_org on public.assignments (organization_id);
create index if not exists idx_assignments_request on public.assignments (request_id);
create index if not exists idx_assignments_resource on public.assignments (resource_id);
create index if not exists idx_assignments_dates on public.assignments (resource_id, start_date, end_date);
create index if not exists idx_risks_request on public.risks (request_id) where active;
create index if not exists idx_allocation_recommendations_request on public.allocation_recommendations (request_id);
create index if not exists idx_scenario_runs_org on public.scenario_runs (organization_id);
