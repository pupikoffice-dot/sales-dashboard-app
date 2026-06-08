-- Username OR email login for Sales Dashboard
-- Run once in Supabase SQL Editor

alter table user_profiles
  add column if not exists username text;

create unique index if not exists user_profiles_username_lower_idx
  on user_profiles (lower(username))
  where username is not null;

comment on column user_profiles.username is
  'Optional login name; auth email is username@dashboard.local when set.';

-- Resolve email or username to auth email (anon-safe for sign-in)
create or replace function resolve_dashboard_login(p_login text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select email
  from user_profiles
  where active = true
    and (
      lower(trim(email)) = lower(trim(p_login))
      or lower(trim(username)) = lower(trim(p_login))
    )
  limit 1;
$$;

grant execute on function resolve_dashboard_login(text) to anon, authenticated;
