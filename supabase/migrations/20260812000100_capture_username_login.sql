-- DRIFT CAPTURE (no-op against production; these objects already exist live).
-- Origin: sales-dashboard-app/supabase/add_username_login.sql, never tracked here.
-- Username logins authenticate as <username>@dashboard.local; this resolver maps
-- either an email or a username to the auth email and is intentionally callable by
-- anon, since it runs before sign-in.
alter table user_profiles
  add column if not exists username text;

create unique index if not exists user_profiles_username_lower_idx
  on user_profiles (lower(username))
  where username is not null;

comment on column user_profiles.username is
  'Optional login name; auth email is username@dashboard.local when set.';

create or replace function public.resolve_dashboard_login(p_login text)
 returns text
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select email
  from user_profiles
  where active = true
    and (
      lower(trim(email)) = lower(trim(p_login))
      or lower(trim(username)) = lower(trim(p_login))
    )
  limit 1;
$function$;

grant execute on function public.resolve_dashboard_login(text) to anon, authenticated;
