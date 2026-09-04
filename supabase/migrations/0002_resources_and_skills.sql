-- RA Copilot: resources, skills, resource_skills, historical_projects, resource_availability

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  employee_code text not null,
  full_name text not null,
  full_name_ar text,
  job_title text not null,
  job_title_ar text,
  grade text,
  department text not null,
  seniority_level integer not null default 1 check (seniority_level between 1 and 5),
  weekly_capacity_hours numeric not null default 40,
  utilization_target numeric not null default 0.85,
  active boolean not null default true,
  location text,
  manager_id uuid references public.resources (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, employee_code)
);

alter table public.profiles
  add constraint profiles_resource_id_fkey foreign key (resource_id) references public.resources (id) on delete set null;

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  name_ar text,
  category text not null default 'general',
  active boolean not null default true,
  unique (organization_id, name)
);

create table if not exists public.resource_skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  skill_id uuid not null references public.skills (id) on delete cascade,
  proficiency integer not null check (proficiency between 1 and 5),
  years_experience numeric not null default 0,
  verified boolean not null default false,
  unique (resource_id, skill_id)
);

create table if not exists public.historical_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  project_name text not null,
  sector text not null default 'general',
  project_type text not null default 'general',
  start_date date not null,
  end_date date,
  performance_score numeric check (performance_score between 0 and 100)
);

create table if not exists public.resource_availability (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  resource_id uuid not null references public.resources (id) on delete cascade,
  date date not null,
  available_hours numeric not null,
  reason text,
  availability_type text not null check (
    availability_type in ('leave', 'training', 'internal_commitment', 'external_assignment', 'manual_adjustment')
  ),
  unique (resource_id, date, availability_type)
);

create index if not exists idx_resources_org on public.resources (organization_id);
create index if not exists idx_resource_skills_org on public.resource_skills (organization_id);
create index if not exists idx_resource_skills_resource on public.resource_skills (resource_id);
create index if not exists idx_resource_skills_skill on public.resource_skills (skill_id);
create index if not exists idx_historical_projects_resource on public.historical_projects (resource_id);
create index if not exists idx_resource_availability_resource_date on public.resource_availability (resource_id, date);
