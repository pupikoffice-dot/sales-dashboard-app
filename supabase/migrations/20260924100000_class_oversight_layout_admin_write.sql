-- Allow role admin to write only their own class_oversight_layout row.
-- Super admin keeps write-any (needed for View-as).

drop policy if exists class_oversight_layout_insert on public.class_oversight_layout;
drop policy if exists class_oversight_layout_update on public.class_oversight_layout;
drop policy if exists class_oversight_layout_delete on public.class_oversight_layout;

create policy class_oversight_layout_insert on public.class_oversight_layout
  for insert to authenticated
  with check (
    is_super_admin()
    or (
      class_id in (
        select auc.class_id
        from public.app_user_class auc
        where auc.user_id = auth.uid()
      )
      and exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.role = 'admin'
      )
    )
  );

create policy class_oversight_layout_update on public.class_oversight_layout
  for update to authenticated
  using (
    is_super_admin()
    or (
      class_id in (
        select auc.class_id
        from public.app_user_class auc
        where auc.user_id = auth.uid()
      )
      and exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.role = 'admin'
      )
    )
  )
  with check (
    is_super_admin()
    or (
      class_id in (
        select auc.class_id
        from public.app_user_class auc
        where auc.user_id = auth.uid()
      )
      and exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.role = 'admin'
      )
    )
  );

create policy class_oversight_layout_delete on public.class_oversight_layout
  for delete to authenticated
  using (
    is_super_admin()
    or (
      class_id in (
        select auc.class_id
        from public.app_user_class auc
        where auc.user_id = auth.uid()
      )
      and exists (
        select 1
        from public.user_profiles up
        where up.id = auth.uid()
          and up.role = 'admin'
      )
    )
  );
