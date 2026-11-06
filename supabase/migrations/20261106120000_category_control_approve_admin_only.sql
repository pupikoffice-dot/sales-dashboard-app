-- Category control: approving a held restore batch is for admins and super admins only
-- (listed writers in category_control_writers may still decide items, but not approve batches).
create or replace function public.cc_can_approve()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and (
    is_super_admin()
    or exists (select 1 from user_profiles p where p.id = auth.uid() and p.role in ('super_admin', 'admin'))
  );
$function$;
revoke all on function public.cc_can_approve() from public, anon, authenticated;

-- approve_held_batch and get_category_control: swap the permission check in place.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.approve_held_batch(bigint, text)'::regprocedure);
  if position('not cc_can_write()' in d) = 0 then raise exception 'approve_held_batch: pattern not found'; end if;
  execute replace(d, 'not cc_can_write()', 'not cc_can_approve()');

  d := pg_get_functiondef('public.get_category_control(text)'::regprocedure);
  if position('''canApprove'', can_write' in d) = 0 then raise exception 'get_category_control: pattern not found'; end if;
  execute replace(d, '''canApprove'', can_write', '''canApprove'', cc_can_approve()');
end $$;
