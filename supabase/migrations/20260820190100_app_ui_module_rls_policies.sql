-- Follow-up: app_ui_module had RLS auto-enabled with no policies after
-- 20260820190000. Match catalog pattern (select all authenticated, write super-admin).
alter table public.app_ui_module enable row level security;
drop policy if exists app_ui_module_select on public.app_ui_module;
create policy app_ui_module_select on public.app_ui_module
  for select to authenticated using (true);
drop policy if exists app_ui_module_write on public.app_ui_module;
create policy app_ui_module_write on public.app_ui_module
  for all to authenticated using (is_super_admin()) with check (is_super_admin());
