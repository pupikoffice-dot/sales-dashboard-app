-- Seed Best sold / Best clients UI modules + per-user grant table.
-- Applied live as migration: best_sold_best_clients_ui_modules

insert into public.app_ui_module (id, label, description, surface, kind, active, sort_order) values
  ('best_sold_items', 'Best sold items',
   'Top 10 SKUs by MTD cash for the Sales Manager suite window (company × agents).',
   'oversight', 'addon', true, 20),
  ('best_clients', 'Best clients',
   'Top 10 clients by MTD cash for the Sales Manager suite window (company × agents).',
   'oversight', 'addon', true, 30)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  surface = excluded.surface,
  kind = excluded.kind,
  active = excluded.active,
  sort_order = excluded.sort_order;

create table if not exists public.dashboard_user_ui (
  user_id uuid not null references auth.users(id) on delete cascade,
  ui_module_id text not null references public.app_ui_module(id) on delete cascade,
  primary key (user_id, ui_module_id)
);

alter table public.dashboard_user_ui enable row level security;

drop policy if exists dashboard_user_ui_select on public.dashboard_user_ui;
create policy dashboard_user_ui_select on public.dashboard_user_ui
  for select to authenticated
  using (user_id = auth.uid() or is_super_admin());

drop policy if exists dashboard_user_ui_write on public.dashboard_user_ui;
create policy dashboard_user_ui_write on public.dashboard_user_ui
  for all to authenticated using (is_super_admin()) with check (is_super_admin());
