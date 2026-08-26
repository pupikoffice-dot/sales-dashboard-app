-- Allow authenticated users to read grants for their own class / own user rows.
-- Needed so non–super-admin users can resolve Oversight UI modules (e.g. Sales Manager suite).
-- Writes remain super-admin only.

drop policy if exists app_grant_select on public.app_grant;

create policy app_grant_select on public.app_grant
  for select to authenticated
  using (
    is_super_admin()
    or (
      class_id is not null
      and class_id in (
        select auc.class_id
        from public.app_user_class auc
        where auc.user_id = auth.uid()
      )
    )
    or (user_id is not null and user_id = auth.uid())
  );
