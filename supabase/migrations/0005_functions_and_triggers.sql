-- RA Copilot: auth helper functions + triggers
-- SECURITY DEFINER functions read profiles as the function owner (bypassing
-- RLS) so they can safely be called *inside* RLS policies without recursion.

create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_resource_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select resource_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_manager_or_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select role in ('admin', 'resource_manager') from public.profiles where id = auth.uid()), false)
$$;

-- keep work_requests.updated_at current
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_work_requests_updated_at on public.work_requests;
create trigger trg_work_requests_updated_at
  before update on public.work_requests
  for each row execute function public.set_updated_at();

-- auto-generate a human-friendly request_number (REQ-<year>-<seq>) per org
create or replace function public.assign_request_number()
returns trigger
language plpgsql
as $$
declare
  next_seq integer;
  year_part text := to_char(coalesce(new.received_date, current_date), 'YYYY');
begin
  if new.request_number is not null and length(trim(new.request_number)) > 0 then
    return new;
  end if;

  select count(*) + 1 into next_seq
  from public.work_requests
  where organization_id = new.organization_id
    and request_number like 'REQ-' || year_part || '-%';

  new.request_number := 'REQ-' || year_part || '-' || lpad(next_seq::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_work_requests_request_number on public.work_requests;
create trigger trg_work_requests_request_number
  before insert on public.work_requests
  for each row execute function public.assign_request_number();

-- provision a profile row automatically when a new auth user carries
-- organization/role metadata (set by the admin invite flow or the seed script)
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ? 'organization_id' then
    insert into public.profiles (id, organization_id, full_name, email, role)
    values (
      new.id,
      (new.raw_user_meta_data ->> 'organization_id')::uuid,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
      new.email,
      coalesce(new.raw_user_meta_data ->> 'role', 'consultant')
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- prevent a non-admin from escalating their own role/org/resource via the
-- "update own profile" RLS policy (RLS is row-level, not column-level, so
-- this is enforced with a guard trigger instead)
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for service-role/superuser contexts (seed scripts,
  -- server-side jobs) which are already trusted and bypass RLS entirely;
  -- only constrain interactive client sessions.
  if auth.uid() is not null and public.current_role() <> 'admin' then
    new.role := old.role;
    new.organization_id := old.organization_id;
    new.resource_id := old.resource_id;
    new.active := old.active;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_fields on public.profiles;
create trigger trg_protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();
