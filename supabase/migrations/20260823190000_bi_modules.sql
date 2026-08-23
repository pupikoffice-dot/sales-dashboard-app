-- BI modules catalog, shared habit config, per-user grants.
-- Applied live to hzgpkkbqhmtwqhkcntcc (migration name: bi_modules_catalog_config_grants).

create table if not exists public.app_bi_module (
  id text primary key,
  label text not null,
  description text,
  needs_agent text not null check (needs_agent in ('all_or_one', 'one_only')),
  uses_habit boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 100
);

alter table public.app_bi_module enable row level security;
create policy app_bi_module_select on public.app_bi_module
  for select to authenticated using (true);
create policy app_bi_module_write on public.app_bi_module
  for all to authenticated using (is_super_admin()) with check (is_super_admin());

insert into public.app_bi_module (id, label, description, needs_agent, uses_habit, sort_order) values
  ('missed_items', 'Missed items',
   'Top SKUs usually sold by the agent (or all) that are in stock now.',
   'all_or_one', true, 10),
  ('missed_clients', 'Missed clients',
   'Top clients who usually buy from the agent (or all).',
   'all_or_one', true, 20),
  ('items_sold_by_others', 'Items sold by others',
   'SKUs sold MTD by other suite agents but not by this agent.',
   'one_only', false, 30)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  needs_agent = excluded.needs_agent,
  uses_habit = excluded.uses_habit,
  sort_order = excluded.sort_order;

create table if not exists public.app_bi_config (
  id boolean primary key default true check (id),
  habit_x int not null default 3 check (habit_x >= 1),
  habit_y int not null default 4 check (habit_y >= 1 and habit_y <= 24),
  updated_at timestamptz not null default now(),
  constraint app_bi_config_xy check (habit_x <= habit_y)
);

alter table public.app_bi_config enable row level security;
create policy app_bi_config_select on public.app_bi_config
  for select to authenticated using (true);
create policy app_bi_config_write on public.app_bi_config
  for all to authenticated using (is_super_admin()) with check (is_super_admin());

insert into public.app_bi_config (id, habit_x, habit_y) values (true, 3, 4)
on conflict (id) do nothing;

create table if not exists public.dashboard_user_bi (
  user_id uuid not null references auth.users(id) on delete cascade,
  bi_module_id text not null references public.app_bi_module(id) on delete cascade,
  primary key (user_id, bi_module_id)
);

alter table public.dashboard_user_bi enable row level security;
create policy dashboard_user_bi_select on public.dashboard_user_bi
  for select to authenticated
  using (user_id = auth.uid() or is_super_admin());
create policy dashboard_user_bi_write on public.dashboard_user_bi
  for all to authenticated using (is_super_admin()) with check (is_super_admin());
