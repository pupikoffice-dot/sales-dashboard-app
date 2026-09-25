-- Deliveries: per-agent / per-client chart boxes saved per user.

alter table public.ops_delivery_lines add column if not exists agent_name text;

create index if not exists ops_delivery_lines_company_agent_idx
  on public.ops_delivery_lines (company, agent_erp_id);
create index if not exists ops_delivery_lines_company_client_idx
  on public.ops_delivery_lines (company, client_id);

drop function if exists public.get_ops_deliveries_monthly(int);

create or replace function public.get_ops_deliveries_monthly(
  p_months int default 12,
  p_company text default null,
  p_agent text default null,
  p_client text default null
)
 returns table (company text, ym text, cartons numeric, pallets numeric)
 language plpgsql
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access;
  v_months int := greatest(1, least(coalesce(p_months, 12), 36));
  v_start date;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null or not coalesce(acc.active, false) then
    return;
  end if;
  if not is_super_admin() and not ('ops_deliveries' = any(coalesce(acc.modules, array[]::text[]))) then
    return;
  end if;

  v_start := (date_trunc('month', (now() at time zone 'Asia/Jerusalem')) - make_interval(months => v_months - 1))::date;

  return query
  select
    l.company,
    to_char(l.line_date, 'YYYY-MM') as ym,
    coalesce(sum(l.qty) filter (where l.item_code = 'ZZ1'), 0)::numeric as cartons,
    coalesce(sum(l.qty) filter (where l.item_code = 'ZZ2'), 0)::numeric as pallets
  from ops_delivery_lines l
  where l.company = any(acc.companies)
    and l.line_date >= v_start
    and (p_company is null or l.company = p_company)
    and (p_agent is null or l.agent_erp_id = p_agent)
    and (p_client is null or l.client_id = p_client)
    and (
      acc.agents is null
      or array_length(acc.agents, 1) is null
      or l.agent_erp_id = any(acc.agents)
    )
  group by l.company, to_char(l.line_date, 'YYYY-MM')
  order by l.company, ym;
end;
$function$;

revoke all on function public.get_ops_deliveries_monthly(int, text, text, text) from public, anon;
grant execute on function public.get_ops_deliveries_monthly(int, text, text, text) to authenticated;

-- Agents and clients the user may pick for a box (within access, last 12 months).
create or replace function public.get_ops_delivery_entities()
 returns table (company text, kind text, entity_id text, name text, cartons numeric, pallets numeric)
 language plpgsql
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access;
  v_start date;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null or not coalesce(acc.active, false) then
    return;
  end if;
  if not is_super_admin() and not ('ops_deliveries' = any(coalesce(acc.modules, array[]::text[]))) then
    return;
  end if;

  v_start := (date_trunc('month', (now() at time zone 'Asia/Jerusalem')) - interval '11 months')::date;

  return query
  with scoped as (
    select l.*
    from ops_delivery_lines l
    where l.company = any(acc.companies)
      and l.line_date >= v_start
      and (
        acc.agents is null
        or array_length(acc.agents, 1) is null
        or l.agent_erp_id = any(acc.agents)
      )
  )
  select s.company, 'agent'::text, s.agent_erp_id, coalesce(max(s.agent_name), s.agent_erp_id),
         coalesce(sum(s.qty) filter (where s.item_code = 'ZZ1'), 0)::numeric,
         coalesce(sum(s.qty) filter (where s.item_code = 'ZZ2'), 0)::numeric
  from scoped s
  where s.agent_erp_id is not null
  group by s.company, s.agent_erp_id
  union all
  select s.company, 'client'::text, s.client_id, coalesce(max(s.client_name), s.client_id),
         coalesce(sum(s.qty) filter (where s.item_code = 'ZZ1'), 0)::numeric,
         coalesce(sum(s.qty) filter (where s.item_code = 'ZZ2'), 0)::numeric
  from scoped s
  where s.client_id is not null
  group by s.company, s.client_id;
end;
$function$;

revoke all on function public.get_ops_delivery_entities() from public, anon;
grant execute on function public.get_ops_delivery_entities() to authenticated;

create table if not exists public.ops_delivery_boxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  company text not null,
  kind text not null check (kind in ('agent', 'client')),
  entity_id text not null,
  label text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, company, kind, entity_id)
);

alter table public.ops_delivery_boxes enable row level security;
drop policy if exists ops_delivery_boxes_own on public.ops_delivery_boxes;
create policy ops_delivery_boxes_own on public.ops_delivery_boxes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
