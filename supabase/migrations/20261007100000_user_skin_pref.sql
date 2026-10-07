-- Per-user look ("skin"), chosen in the header. Each user reads and writes only their own row.
create table if not exists public.dashboard_user_prefs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  skin       text not null default 'classic' check (skin in ('classic', 'bento')),
  updated_at timestamptz not null default now()
);

alter table public.dashboard_user_prefs enable row level security;

drop policy if exists dashboard_user_prefs_select_own on public.dashboard_user_prefs;
create policy dashboard_user_prefs_select_own on public.dashboard_user_prefs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists dashboard_user_prefs_insert_own on public.dashboard_user_prefs;
create policy dashboard_user_prefs_insert_own on public.dashboard_user_prefs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists dashboard_user_prefs_update_own on public.dashboard_user_prefs;
create policy dashboard_user_prefs_update_own on public.dashboard_user_prefs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.dashboard_user_prefs to authenticated;
