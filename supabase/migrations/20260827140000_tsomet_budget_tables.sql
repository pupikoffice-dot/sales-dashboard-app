-- Mirror of Mobile App migration for sales-dashboard-app repo tracking.
-- Live apply: hzgpkkbqhmtwqhkcntcc (tsomet_budget_tables).

create table if not exists public.tsomet_store_budget (
  store_number text primary key,
  store_name text not null default '',
  budget_cash numeric not null default 0,
  erp_number text not null default '',
  agent_number text not null default '',
  synced_at timestamptz not null default now()
);

alter table public.tsomet_store_budget enable row level security;
drop policy if exists tsomet_store_budget_select on public.tsomet_store_budget;
create policy tsomet_store_budget_select on public.tsomet_store_budget
  for select to authenticated using (true);
drop policy if exists tsomet_store_budget_write on public.tsomet_store_budget;
create policy tsomet_store_budget_write on public.tsomet_store_budget
  for all to authenticated using (is_super_admin()) with check (is_super_admin());

create table if not exists public.tsomet_store_sales (
  store_number text primary key,
  qty numeric not null default 0,
  cash numeric not null default 0,
  report_date date,
  synced_at timestamptz not null default now()
);

alter table public.tsomet_store_sales enable row level security;
drop policy if exists tsomet_store_sales_select on public.tsomet_store_sales;
create policy tsomet_store_sales_select on public.tsomet_store_sales
  for select to authenticated using (true);
drop policy if exists tsomet_store_sales_write on public.tsomet_store_sales;
create policy tsomet_store_sales_write on public.tsomet_store_sales
  for all to authenticated using (is_super_admin()) with check (is_super_admin());

insert into public.app_bi_module (id, label, description, needs_agent, uses_habit, sort_order) values
  ('tsomet_budget', 'Tsomet Budget',
   'Monkeytime store budget vs Orders MTD and segment sales (agent-scoped).',
   'all_or_one', false, 40)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  needs_agent = excluded.needs_agent,
  uses_habit = excluded.uses_habit,
  sort_order = excluded.sort_order;
