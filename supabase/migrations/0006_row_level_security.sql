-- RA Copilot: Row Level Security
-- Every tenant table is scoped by organization_id = public.current_org_id().
-- Consultants get row-level narrowing to their own resource on
-- capacity/assignment data; write access follows the role matrix in the
-- product spec (admin > resource_manager > consultant/executive_viewer).

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.resources enable row level security;
alter table public.skills enable row level security;
alter table public.resource_skills enable row level security;
alter table public.historical_projects enable row level security;
alter table public.resource_availability enable row level security;
alter table public.work_requests enable row level security;
alter table public.request_skills enable row level security;
alter table public.deliverables enable row level security;
alter table public.assignments enable row level security;
alter table public.risks enable row level security;
alter table public.allocation_recommendations enable row level security;
alter table public.scenario_runs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;

-- organizations ---------------------------------------------------------
create policy org_select on public.organizations
  for select using (id = public.current_org_id());
create policy org_update_admin on public.organizations
  for update using (id = public.current_org_id() and public.current_role() = 'admin');

-- profiles ----------------------------------------------------------------
create policy profiles_select on public.profiles
  for select using (organization_id = public.current_org_id());
create policy profiles_insert_admin on public.profiles
  for insert with check (organization_id = public.current_org_id() and public.current_role() = 'admin');
create policy profiles_update on public.profiles
  for update using (
    organization_id = public.current_org_id()
    and (id = auth.uid() or public.current_role() = 'admin')
  );
create policy profiles_delete_admin on public.profiles
  for delete using (organization_id = public.current_org_id() and public.current_role() = 'admin');

-- resources -----------------------------------------------------------------
create policy resources_select on public.resources
  for select using (
    organization_id = public.current_org_id()
    and (public.current_role() <> 'consultant' or id = public.current_resource_id())
  );
create policy resources_write_admin on public.resources
  for all using (organization_id = public.current_org_id() and public.current_role() = 'admin')
  with check (organization_id = public.current_org_id() and public.current_role() = 'admin');

-- skills --------------------------------------------------------------------
create policy skills_select on public.skills
  for select using (organization_id = public.current_org_id());
create policy skills_write_admin on public.skills
  for all using (organization_id = public.current_org_id() and public.current_role() = 'admin')
  with check (organization_id = public.current_org_id() and public.current_role() = 'admin');

-- resource_skills -------------------------------------------------------------
create policy resource_skills_select on public.resource_skills
  for select using (
    organization_id = public.current_org_id()
    and (public.current_role() <> 'consultant' or resource_id = public.current_resource_id())
  );
create policy resource_skills_write_admin on public.resource_skills
  for all using (organization_id = public.current_org_id() and public.current_role() = 'admin')
  with check (organization_id = public.current_org_id() and public.current_role() = 'admin');

-- historical_projects -----------------------------------------------------
create policy historical_projects_select on public.historical_projects
  for select using (
    organization_id = public.current_org_id()
    and (public.current_role() <> 'consultant' or resource_id = public.current_resource_id())
  );
create policy historical_projects_write_manager on public.historical_projects
  for all using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- resource_availability -----------------------------------------------------
create policy resource_availability_select on public.resource_availability
  for select using (
    organization_id = public.current_org_id()
    and (public.current_role() <> 'consultant' or resource_id = public.current_resource_id())
  );
create policy resource_availability_write_manager on public.resource_availability
  for all using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- work_requests ---------------------------------------------------------------
create policy work_requests_select on public.work_requests
  for select using (
    organization_id = public.current_org_id()
    and (
      public.current_role() <> 'consultant'
      or exists (
        select 1 from public.assignments a
        where a.request_id = work_requests.id and a.resource_id = public.current_resource_id()
      )
    )
  );
create policy work_requests_write_manager on public.work_requests
  for all using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- request_skills ----------------------------------------------------------
create policy request_skills_select on public.request_skills
  for select using (
    organization_id = public.current_org_id()
    and (
      public.current_role() <> 'consultant'
      or exists (
        select 1 from public.assignments a
        where a.request_id = request_skills.request_id and a.resource_id = public.current_resource_id()
      )
    )
  );
create policy request_skills_write_manager on public.request_skills
  for all using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- deliverables ----------------------------------------------------------------
create policy deliverables_select on public.deliverables
  for select using (
    organization_id = public.current_org_id()
    and (
      public.current_role() <> 'consultant'
      or owner_resource_id = public.current_resource_id()
      or exists (
        select 1 from public.assignments a
        where a.request_id = deliverables.request_id and a.resource_id = public.current_resource_id()
      )
    )
  );
create policy deliverables_write_manager on public.deliverables
  for all using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- assignments -------------------------------------------------------------
create policy assignments_select on public.assignments
  for select using (
    organization_id = public.current_org_id()
    and (public.current_role() <> 'consultant' or resource_id = public.current_resource_id())
  );
create policy assignments_write_manager on public.assignments
  for all using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- risks -----------------------------------------------------------------------
create policy risks_select on public.risks
  for select using (
    organization_id = public.current_org_id()
    and (
      public.current_role() <> 'consultant'
      or exists (
        select 1 from public.assignments a
        where a.request_id = risks.request_id and a.resource_id = public.current_resource_id()
      )
    )
  );
create policy risks_write_manager on public.risks
  for all using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- allocation_recommendations ---------------------------------------------
create policy allocation_recommendations_select on public.allocation_recommendations
  for select using (organization_id = public.current_org_id() and public.current_role() <> 'consultant');
create policy allocation_recommendations_write_manager on public.allocation_recommendations
  for all using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- scenario_runs -----------------------------------------------------------
create policy scenario_runs_all_manager on public.scenario_runs
  for all using (organization_id = public.current_org_id() and public.is_manager_or_admin())
  with check (organization_id = public.current_org_id() and public.is_manager_or_admin());

-- audit_logs ----------------------------------------------------------------
create policy audit_logs_select_manager on public.audit_logs
  for select using (organization_id = public.current_org_id() and public.is_manager_or_admin());
create policy audit_logs_insert on public.audit_logs
  for insert with check (organization_id = public.current_org_id() and user_id = auth.uid());

-- notifications ---------------------------------------------------------------
create policy notifications_select on public.notifications
  for select using (
    organization_id = public.current_org_id()
    and (user_id = auth.uid() or user_id is null)
  );
create policy notifications_update_own on public.notifications
  for update using (
    organization_id = public.current_org_id()
    and (user_id = auth.uid() or public.is_manager_or_admin())
  );
create policy notifications_insert_manager on public.notifications
  for insert with check (organization_id = public.current_org_id() and public.is_manager_or_admin());
create policy notifications_delete_manager on public.notifications
  for delete using (organization_id = public.current_org_id() and public.is_manager_or_admin());
