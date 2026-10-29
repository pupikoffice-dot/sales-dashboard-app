-- data_health_notices(): also say whether an admin has already acknowledged the open incident, so the admin bar and badge
-- count only what nobody has looked at yet (acknowledged = known and being handled), while users still see real stale data.
create or replace function public.data_health_notices()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'last_run_at', (select s.last_run_at from public.data_health_settings s where s.id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('check_key', f.check_key, 'file_group', f.file_group, 'company', f.company,
               'status', f.status, 'modified_at', f.modified_at, 'age_hours', f.age_hours,
               'acknowledged', exists (select 1 from public.data_health_incidents i
                                        where i.check_key = f.check_key and i.closed_at is null and i.acknowledged_at is not null))
             order by f.check_key)
      from public.source_file_status f
      where f.status in ('red', 'amber')
    ), '[]'::jsonb));
$$;
revoke all on function public.data_health_notices() from public, anon;
grant execute on function public.data_health_notices() to authenticated;
