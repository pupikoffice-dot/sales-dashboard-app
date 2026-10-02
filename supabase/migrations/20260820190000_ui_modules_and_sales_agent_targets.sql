-- UI module catalog (suite | addon). Do not use "widget" — clashes with legacy widget.* nodes.
create table if not exists public.app_ui_module (
  id text primary key,
  label text not null,
  surface text not null check (surface in ('oversight', 'sidebar')),
  kind text not null check (kind in ('suite', 'addon')),
  active boolean not null default true,
  sort_order int not null default 100,
  description text
);
-- Note: if this CREATE already ran without `active`, see 20260820190200.
-- Catalog RLS policies: 20260820190100.

insert into public.app_ui_module (id, label, surface, kind, sort_order, description) values
  ('sales_manager', 'Sales Manager Module', 'oversight', 'suite', 10,
   'Replaces classic Oversight with All + per-agent KPI cubes.')
on conflict (id) do update set label = excluded.label, kind = excluded.kind, surface = excluded.surface;

-- Optional: register permission nodes for grants (if app_node is used for UI)
-- Prefer class grants: kind=node, key=ui.oversight.suite.sales_manager, value=null

create table if not exists public.sales_agent_targets (
  agent_erp_id text not null,
  year int not null,
  month int not null check (month between 1 and 12),
  target_cash numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (agent_erp_id, year, month)
);

alter table public.sales_agent_targets enable row level security;
drop policy if exists sales_agent_targets_select on public.sales_agent_targets;
create policy sales_agent_targets_select on public.sales_agent_targets
  for select to authenticated using (true);
drop policy if exists sales_agent_targets_write on public.sales_agent_targets;
create policy sales_agent_targets_write on public.sales_agent_targets
  for all to authenticated using (is_super_admin()) with check (is_super_admin());
-- ETL uses service role (bypasses RLS)
