-- Data health, in-app alerting (2026-10-29).
-- 1. Admins (role 'admin') see and acknowledge data health, not only super admins.
-- 2. data_health_notices(): the red/amber statuses for ANY signed-in user, no reasons or fix hints, so screens can say
--    "this data is older than expected".
-- 3. The checker records every run (last_run_at) and every email failure (last_send_error) so silence is never ambiguous.
-- 4. data_health_latest() also returns first_seen (coverage guard: a loaded file without a rule is flagged).
-- 5. data_health_content(): the newest date INSIDE the loaded sales tables (a new file can still hold old data).

create or replace function public.can_see_data_health()
returns boolean language sql stable security definer set search_path to 'public' as $$
  select public.is_super_admin()
      or exists (select 1 from public.user_profiles up where up.id = auth.uid() and up.role = 'admin');
$$;
revoke all on function public.can_see_data_health() from public, anon;
grant execute on function public.can_see_data_health() to authenticated;

drop policy if exists source_files_read     on public.source_files;
drop policy if exists source_file_obs_read  on public.source_file_observations;
drop policy if exists source_file_stat_read on public.source_file_status;
drop policy if exists dh_incidents_read     on public.data_health_incidents;
drop policy if exists dh_settings_read      on public.data_health_settings;
create policy source_files_read     on public.source_files             for select to authenticated using (public.can_see_data_health());
create policy source_file_obs_read  on public.source_file_observations for select to authenticated using (public.can_see_data_health());
create policy source_file_stat_read on public.source_file_status       for select to authenticated using (public.can_see_data_health());
create policy dh_incidents_read     on public.data_health_incidents    for select to authenticated using (public.can_see_data_health());
create policy dh_settings_read      on public.data_health_settings     for select to authenticated using (public.can_see_data_health());

create or replace function public.data_health_ack(p_incident_id bigint, p_notes text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.can_see_data_health() then
    raise exception 'not allowed';
  end if;
  update public.data_health_incidents
     set acknowledged_at = now(), notes = nullif(btrim(coalesce(p_notes, '')), '')
   where id = p_incident_id and closed_at is null;
end;
$$;
revoke all on function public.data_health_ack(bigint, text) from public;
grant execute on function public.data_health_ack(bigint, text) to authenticated;

alter table public.data_health_settings add column if not exists last_run_at     timestamptz;
alter table public.data_health_settings add column if not exists last_send_at    timestamptz;
alter table public.data_health_settings add column if not exists last_send_error text;

-- Coverage guard: when the sync first saw each file (within the 30 days that the function looks at).
drop function if exists public.data_health_latest();
create or replace function public.data_health_latest()
returns table(file_name text, observed_at timestamptz, modified_at timestamptz, rows_loaded integer, processed boolean,
              history integer[], first_seen timestamptz)
language sql stable set search_path to 'public' as $$
  with ranked as (
    select o.*, row_number() over (partition by o.file_name order by o.observed_at desc) rn,
           min(o.observed_at) over (partition by o.file_name) first_seen
    from public.source_file_observations o
    where o.observed_at > now() - interval '30 days'
  )
  select l.file_name, l.observed_at, l.modified_at, l.rows_loaded, l.processed,
         coalesce((select array_agg(h.rows_loaded order by h.observed_at desc)
                   from ranked h
                   where h.file_name = l.file_name and h.rn between 2 and 11
                     and h.processed and h.rows_loaded is not null), '{}'),
         l.first_seen
  from ranked l
  where l.rn = 1;
$$;
revoke all on function public.data_health_latest() from public, anon, authenticated;
grant execute on function public.data_health_latest() to service_role;

-- What every signed-in user may know: which sources are late. No reasons, hints or file paths.
create or replace function public.data_health_notices()
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'last_run_at', (select s.last_run_at from public.data_health_settings s where s.id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('check_key', f.check_key, 'file_group', f.file_group, 'company', f.company,
               'status', f.status, 'modified_at', f.modified_at, 'age_hours', f.age_hours) order by f.check_key)
      from public.source_file_status f
      where f.status in ('red', 'amber')
    ), '[]'::jsonb));
$$;
revoke all on function public.data_health_notices() from public, anon;
grant execute on function public.data_health_notices() to authenticated;

-- Newest date inside the loaded sales tables. Gold is left out on purpose: it does not sell every day.
create or replace function public.data_health_content()
returns table(check_key text, file_group text, company text, label text, newest date)
language sql stable security definer set search_path to 'public' set statement_timeout to '60s' as $$
  with src(company, line_source, label) as (values
    ('pupik', 'rep891pupik',      'sales (891) loaded in the database'),
    ('mt',    'rep891mt',         'sales (891) loaded in the database'),
    ('pupik', '722-order',        'orders (722) loaded in the database'),
    ('mt',    '722-order',        'orders (722) loaded in the database'),
    ('pupik', '720-open-delivery','open deliveries (720) loaded in the database'),
    ('mt',    '720-open-delivery','open deliveries (720) loaded in the database'))
  select 'content:' || s.line_source || ':' || s.company, 'content', s.company, s.label,
         (select max(l.line_date) from public.sales_lines l
           where l.company = s.company and l.line_source = s.line_source
             and l.year >= extract(year from current_date)::int - 1)
  from src s;
$$;
revoke all on function public.data_health_content() from public, anon, authenticated;
grant execute on function public.data_health_content() to service_role;
