-- Backfill user_profiles + dashboard_user_access for auth users missing a profile
-- (e.g. create succeeded in Auth but profile upsert failed on invalid role enum)

insert into user_profiles (id, email, username, name, role, active)
select
  u.id,
  u.email,
  case
    when u.email ilike '%@dashboard.local' then split_part(u.email, '@', 1)
    else null
  end as username,
  coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)) as name,
  case
    when u.raw_user_meta_data->>'role' in ('super_admin', 'admin', 'manager', 'agent')
      then (u.raw_user_meta_data->>'role')::user_role
    else 'agent'::user_role
  end as role,
  true as active
from auth.users u
left join user_profiles p on p.id = u.id
where p.id is null;

insert into dashboard_user_access (user_id, modules, companies, agents, default_module, active, updated_at)
select
  p.id,
  array['oversite']::text[],
  array['pupik']::text[],
  null,
  'oversite',
  true,
  now()
from user_profiles p
left join dashboard_user_access a on a.user_id = p.id
where a.user_id is null
  and p.role <> 'super_admin';
