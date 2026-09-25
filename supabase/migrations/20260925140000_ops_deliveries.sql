-- Operations → Deliveries: rep893 logistics lines (ZZ1 cartons, ZZ2 pallets) + monthly RPC.
-- Loaded by Mobile App sync (_sync_rep893): snapshot per company.

create table if not exists public.ops_delivery_lines (
  id bigserial primary key,
  company text not null,
  line_date date not null,
  agent_erp_id text,
  client_id text,
  client_name text,
  doc_num text,
  item_code text not null,
  qty numeric not null default 0,
  synced_at timestamptz not null default now()
);

create index if not exists ops_delivery_lines_company_date_idx
  on public.ops_delivery_lines (company, line_date);

alter table public.ops_delivery_lines enable row level security;
drop policy if exists ops_delivery_lines_write on public.ops_delivery_lines;
create policy ops_delivery_lines_write on public.ops_delivery_lines
  for all to authenticated using (is_super_admin()) with check (is_super_admin());

insert into public.dashboard_modules (id, label, description, sort_order) values
  ('ops_deliveries', 'Deliveries', 'Operations: monthly cartons (ZZ1) and pallets (ZZ2) delivered', 100)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;

create or replace function public.get_ops_deliveries_monthly(p_months int default 12)
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
    and (
      acc.agents is null
      or array_length(acc.agents, 1) is null
      or l.agent_erp_id = any(acc.agents)
    )
  group by l.company, to_char(l.line_date, 'YYYY-MM')
  order by l.company, ym;
end;
$function$;

revoke all on function public.get_ops_deliveries_monthly(int) from public, anon;
grant execute on function public.get_ops_deliveries_monthly(int) to authenticated;
