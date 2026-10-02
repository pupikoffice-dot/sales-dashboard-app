-- ERP agent code on client master (from account export סוכן / agent column).
-- Sync fills this; trigger maps to user_profiles.agent_erp_id → assigned_agent_id when possible.

alter table clients add column if not exists erp_agent_id text;

comment on column clients.erp_agent_id is
  'Agent code from ERP client export; matched to user_profiles.agent_erp_id on insert/update.';

create or replace function public.clients_assign_from_erp_agent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.erp_agent_id is not null and length(trim(new.erp_agent_id)) > 0 then
    new.assigned_agent_id := (
      select up.id
      from user_profiles up
      where up.active = true
        and up.role = 'agent'
        and up.agent_erp_id is not null
        and lower(trim(up.agent_erp_id)) = lower(trim(new.erp_agent_id))
      order by up.created_at
      limit 1
    );
  end if;
  return new;
end;
$$;

drop trigger if exists clients_assign_from_erp_agent_trg on clients;
create trigger clients_assign_from_erp_agent_trg
  before insert or update of erp_agent_id on clients
  for each row
  execute function public.clients_assign_from_erp_agent();
