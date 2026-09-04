-- RA Copilot: extensions + organizations + profiles
-- Plain PostgreSQL features only (uuid + jsonb + check constraints) so this
-- schema can be moved off Supabase later without rewrites.

create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_ar text,
  timezone text not null default 'Asia/Riyadh',
  working_days jsonb not null default '[0,1,2,3,4]'::jsonb, -- 0=Sunday .. 6=Saturday
  daily_work_hours numeric not null default 8,
  weekly_work_hours numeric not null default 40,
  target_utilization numeric not null default 0.85,
  overload_threshold numeric not null default 0.90,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('admin', 'resource_manager', 'consultant', 'executive_viewer')),
  resource_id uuid, -- FK added in 0002 once public.resources exists
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_org on public.profiles (organization_id);

comment on table public.organizations is 'One row per tenant. Every tenant-scoped table carries organization_id and is protected by RLS.';
comment on table public.profiles is 'Extends auth.users with organization membership and product role.';
