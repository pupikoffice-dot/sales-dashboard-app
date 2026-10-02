-- Dashboard module permissions for web sales dashboard (extends Sales Team auth)

create table if not exists dashboard_modules (
  id          text primary key,
  label       text not null,
  description text,
  sort_order  int not null default 0
);

insert into dashboard_modules (id, label, description, sort_order) values
  ('oversite',          'Oversite',           'Homepage KPIs and summaries', 10),
  ('sales_performance', 'Sales Performance',  'Sales MTD, charts, clients/items', 20),
  ('orders_mtd',        'Orders MTD',         'All orders this month (722)', 30),
  ('open_orders',       'Open Orders',        'Undelivered orders (721)', 40),
  ('returns',           'Returns',            'Returns MTD', 50),
  ('debt',              'Open Debt',          'Debt summary and full report', 60),
  ('stock_alerts',      'Stock Alerts',       'Slow movers, client alerts, velocity', 70),
  ('stock',             'Stock',              'Warehouse stock view', 80),
  ('export',            'Export',             'CSV/XLS export actions', 90)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  sort_order = excluded.sort_order;

create table if not exists dashboard_user_access (
  user_id         uuid primary key references user_profiles(id) on delete cascade,
  modules         text[] not null default '{}',
  companies       text[] not null default '{}',
  agents          text[],
  default_module  text references dashboard_modules(id),
  active          boolean not null default true,
  updated_at      timestamptz not null default now()
);

comment on table dashboard_user_access is
  'Per-user dashboard module visibility and data scope (company + agent).';

create index if not exists dashboard_user_access_active_idx
  on dashboard_user_access (active) where active = true;

alter table dashboard_modules enable row level security;
alter table dashboard_user_access enable row level security;

-- Module catalog: any authenticated user can read
create policy "dashboard_modules_select" on dashboard_modules
  for select to authenticated using (true);

-- Users read own access row; super_admin reads all
create policy "dashboard_access_select_own" on dashboard_user_access
  for select to authenticated
  using (user_id = auth.uid() or is_super_admin());

-- Super admin manages all access rows
create policy "dashboard_access_write_super" on dashboard_user_access
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- Default full access for super_admin users without a row yet (helper view optional)
create or replace function get_dashboard_access(p_user_id uuid default auth.uid())
returns dashboard_user_access
language plpgsql
security definer
set search_path = public
as $$
declare
  row dashboard_user_access;
begin
  select * into row from dashboard_user_access where user_id = p_user_id;
  if found then
    return row;
  end if;
  if is_super_admin() and p_user_id = auth.uid() then
    row.user_id := p_user_id;
    row.modules := array(select id from dashboard_modules order by sort_order);
    row.companies := array['pupik','mt','grow'];
    row.agents := null;
    row.default_module := 'oversite';
    row.active := true;
    return row;
  end if;
  return null;
end;
$$;

grant execute on function get_dashboard_access(uuid) to authenticated;
