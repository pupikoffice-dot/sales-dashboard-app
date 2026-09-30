-- Per-user sidebar button hides, and let admin-role users read/edit access for their team.

alter table public.dashboard_user_access
  add column if not exists hidden_sidebar text[] not null default '{}';

drop policy if exists dashboard_access_select_admin on public.dashboard_user_access;
create policy dashboard_access_select_admin on public.dashboard_user_access
  for select to authenticated
  using (
    is_admin_or_above()
    and user_id in (select public.get_subtree_ids(auth.uid()))
  );

drop policy if exists dashboard_access_write_admin on public.dashboard_user_access;
create policy dashboard_access_write_admin on public.dashboard_user_access
  for all to authenticated
  using (
    is_admin_or_above()
    and (
      user_id = auth.uid()
      or user_id in (select public.get_subtree_ids(auth.uid()))
    )
  )
  with check (
    is_admin_or_above()
    and (
      user_id = auth.uid()
      or user_id in (select public.get_subtree_ids(auth.uid()))
    )
  );
