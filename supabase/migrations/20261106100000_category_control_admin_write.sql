-- Category control: users with the admin role may decide (remove / leave / never flag / undo), like super admins.
-- Approving a held batch stays super-admin only.
create or replace function public.cc_can_write()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and (
    is_super_admin()
    or exists (select 1 from user_profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin'))
    or exists (select 1 from category_control_writers w where w.user_id = auth.uid())
  );
$function$;
revoke all on function public.cc_can_write() from public, anon, authenticated;
