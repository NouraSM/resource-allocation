-- RA Copilot: workflow-based notification triggers.
-- These only react to state transitions (status changed to at_risk, a
-- critical request sitting unallocated) — they never duplicate the
-- capacity/utilization math that lives in src/engine/*.ts. Score-driven
-- notifications (resource overload, delivery-risk score crossing a
-- threshold) are raised by the client right after the calculation that
-- produced them, so the formula stays defined in exactly one place.

create or replace function public.notify_request_at_risk()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'at_risk' and (old.status is distinct from 'at_risk') then
    insert into public.notifications (organization_id, user_id, notification_type, severity, title, message, entity_type, entity_id)
    values (
      new.organization_id,
      null,
      'delivery_risk_high',
      'warning',
      new.title || ' delivery risk increased',
      'This request moved to At Risk status.',
      'work_request',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_request_at_risk on public.work_requests;
create trigger trg_notify_request_at_risk
  after update on public.work_requests
  for each row execute function public.notify_request_at_risk();

create or replace function public.notify_critical_unallocated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.priority_level = 'critical'
     and new.status in ('submitted', 'under_review', 'ready_for_allocation')
     and not exists (
       select 1 from public.assignments a
       where a.request_id = new.id and a.status <> 'cancelled'
     )
     and not exists (
       select 1 from public.notifications n
       where n.entity_id = new.id and n.notification_type = 'critical_unallocated' and n.read = false
     )
  then
    insert into public.notifications (organization_id, user_id, notification_type, severity, title, message, entity_type, entity_id)
    values (
      new.organization_id,
      null,
      'critical_unallocated',
      'critical',
      new.title || ' has no allocation',
      'A critical-priority request has no assigned team yet.',
      'work_request',
      new.id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_critical_unallocated on public.work_requests;
create trigger trg_notify_critical_unallocated
  after insert or update on public.work_requests
  for each row execute function public.notify_critical_unallocated();
