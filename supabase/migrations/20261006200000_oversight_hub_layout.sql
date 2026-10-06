-- Oversight "Hub" layout (chart-first). Granted per user like Sales Manager (dashboard_user_ui);
-- users without the grant keep Classic. Admins grant it in Admin -> Users (Oversight layouts).
insert into public.app_ui_module (id, label, surface, kind, sort_order, description, active) values
  ('hub', 'Performance Hub', 'oversight', 'suite', 15,
   'Chart-first Oversight: KPI tiles, 30-day orders, leaderboard, forecast, products, heatmap, deliveries.', true)
on conflict (id) do update set label = excluded.label, kind = excluded.kind, surface = excluded.surface,
  description = excluded.description, active = excluded.active;
