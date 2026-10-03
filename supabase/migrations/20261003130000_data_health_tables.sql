-- Data health monitor: rules, per-run file observations, current status, incidents, settings.
-- Spec: docs/superpowers/specs/2026-10-03-data-health-monitor-design.md
create table if not exists public.source_files (
  file_name     text primary key,          -- as on disk; tsomet files use 'tsomet/budget.xlsx', 'tsomet/sales.xlsx'
  company       text,
  file_group    text not null,             -- p1 | rep722 | wms | nightly_aski | manual_sales | manual_ref | manual_clients | debt | tsomet | known_broken | frozen
  producer      text not null,
  fix_hint      text not null,
  impact        text not null,
  rule_kind     text not null check (rule_kind in ('age', 'nightly', 'frozen')),
  max_age_hours numeric,
  eval_from     time,                      -- local Asia/Jerusalem; null = whenever the checker runs
  eval_to       time,
  active        boolean not null default true
);

create table if not exists public.source_file_observations (
  id           bigint generated always as identity primary key,
  observed_at  timestamptz not null default now(),
  sync_log_id  uuid,
  host         text,
  file_name    text not null,
  modified_at  timestamptz,
  size_bytes   bigint,
  rows_loaded  integer,                     -- null = not loaded in this run
  processed    boolean not null default false
);
create index if not exists source_file_observations_file_time
  on public.source_file_observations (file_name, observed_at desc);

create table if not exists public.source_file_status (
  check_key    text primary key,            -- file name, 'rows:<file>', 'sync:no_success', 'sync:stuck'
  file_name    text,
  file_group   text not null,
  company      text,
  status       text not null check (status in ('green', 'amber', 'red', 'grey')),
  reason       text not null,
  modified_at  timestamptz,
  age_hours    numeric,
  rows_loaded  integer,
  evaluated_at timestamptz not null default now()
);

create table if not exists public.data_health_incidents (
  id               bigint generated always as identity primary key,
  check_key        text not null,
  opened_at        timestamptz not null default now(),
  closed_at        timestamptz,
  severity         text not null default 'red',
  reason           text not null,
  acknowledged_at  timestamptz,
  last_notified_at timestamptz,
  notes            text
);
create unique index if not exists data_health_incidents_one_open
  on public.data_health_incidents (check_key) where closed_at is null;

create table if not exists public.data_health_settings (
  id                boolean primary key default true check (id),
  recipients        text[] not null default '{}',
  from_address      text not null default 'onboarding@resend.dev',
  summary_time      time not null default '07:30',
  enabled           boolean not null default true,
  last_summary_date date
);

alter table public.source_files             enable row level security;
alter table public.source_file_observations enable row level security;
alter table public.source_file_status       enable row level security;
alter table public.data_health_incidents    enable row level security;
alter table public.data_health_settings     enable row level security;

create policy source_files_read     on public.source_files             for select to authenticated using (public.is_super_admin());
create policy source_file_obs_read  on public.source_file_observations for select to authenticated using (public.is_super_admin());
create policy source_file_stat_read on public.source_file_status       for select to authenticated using (public.is_super_admin());
create policy dh_incidents_read     on public.data_health_incidents    for select to authenticated using (public.is_super_admin());
create policy dh_settings_read      on public.data_health_settings     for select to authenticated using (public.is_super_admin());
-- Writes: service role only (sync + edge function bypass RLS); acknowledge goes through the RPC below.

create or replace function public.data_health_ack(p_incident_id bigint, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'not allowed';
  end if;
  update public.data_health_incidents
     set acknowledged_at = coalesce(acknowledged_at, now()),
         notes = coalesce(p_notes, notes)
   where id = p_incident_id;
end $$;
revoke all on function public.data_health_ack(bigint, text) from public;
grant execute on function public.data_health_ack(bigint, text) to authenticated;

-- Checker input: latest observation per file + rows_loaded of up to 10 earlier processed runs (newest first).
create or replace function public.data_health_latest()
returns table (file_name text, observed_at timestamptz, modified_at timestamptz,
               rows_loaded integer, processed boolean, history integer[])
language sql stable set search_path = public as $$
  with ranked as (
    select o.*, row_number() over (partition by o.file_name order by o.observed_at desc) rn
    from public.source_file_observations o
    where o.observed_at > now() - interval '30 days'
  )
  select l.file_name, l.observed_at, l.modified_at, l.rows_loaded, l.processed,
         coalesce((select array_agg(h.rows_loaded order by h.observed_at desc)
                   from ranked h
                   where h.file_name = l.file_name and h.rn between 2 and 11
                     and h.processed and h.rows_loaded is not null), '{}')
  from ranked l
  where l.rn = 1;
$$;
revoke all on function public.data_health_latest() from public, anon, authenticated;
grant execute on function public.data_health_latest() to service_role;
