-- ============================================================================
-- PHASE 2.1 -- versioning + restore points. Must land before Phase 3 (the
-- risky RPC cutover) per the approved plan's "Save & recovery" design.
--
-- Still shadow mode: rpc_version/active_version are not read by any live RPC
-- yet (that wiring is Phase 3 itself). This migration only builds the
-- machinery and declares the current app as version 1.0.
-- ============================================================================

-- --- 1. Runtime config: single row, the database's own idea of what's live --
create table if not exists app_runtime_config (
  id             boolean primary key default true check (id),  -- enforces a single row
  active_version text not null default '1.0',
  rpc_version    text not null default 'v1',                    -- 'v1' | 'v2'
  updated_at     timestamptz not null default now(),
  updated_by     uuid references user_profiles(id)
);
insert into app_runtime_config (id) values (true) on conflict (id) do nothing;

alter table app_runtime_config enable row level security;
drop policy if exists app_runtime_config_select on app_runtime_config;
create policy app_runtime_config_select on app_runtime_config for select to authenticated using (true);
drop policy if exists app_runtime_config_write on app_runtime_config;
create policy app_runtime_config_write on app_runtime_config for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- --- 2. Versions: a bundle of {deployment, data path, permission config} ---
create table if not exists app_version (
  version        text primary key,             -- '1.0', '2.0', '2.1'
  released_at    timestamptz not null default now(),
  released_by    uuid references user_profiles(id),
  channel        node_channel not null,         -- 'stable' | 'beta' (reuses Phase 2's enum)
  rpc_version    text not null,                 -- 'v1' | 'v2'
  deployment_url text,
  config         jsonb not null,                -- app_class/app_user_class/app_grant/app_node/app_node_edge snapshot
  is_stable      boolean not null default false,
  summary        text not null
);

alter table app_version enable row level security;
drop policy if exists app_version_select on app_version;
create policy app_version_select on app_version for select to authenticated using (true);
drop policy if exists app_version_write on app_version;
create policy app_version_write on app_version for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- --- 3. Restore points: automatic snapshots, no version number -------------
create table if not exists app_restore_point (
  id          bigserial primary key,
  label       text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references user_profiles(id),
  rpc_version text not null,
  config      jsonb not null,
  notes       text
);

alter table app_restore_point enable row level security;
drop policy if exists app_restore_point_select on app_restore_point;
create policy app_restore_point_select on app_restore_point for select to authenticated using (is_super_admin());
drop policy if exists app_restore_point_write on app_restore_point;
create policy app_restore_point_write on app_restore_point for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- --- 4. Snapshot helper: the five shadow-mode tables, as one jsonb blob ----
create or replace function public._snapshot_permission_config()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'app_class',      (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from app_class c),
    'app_user_class', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from app_user_class c),
    'app_grant',      (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from app_grant c),
    'app_node',       (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from app_node c),
    'app_node_edge',  (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from app_node_edge c)
  )
$function$;

-- --- 5. release_version(): snapshot current state as a new named version --
create or replace function public.release_version(
  p_version text,
  p_summary text,
  p_deployment_url text default null,
  p_channel node_channel default 'stable'
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_rpc text;
begin
  if not is_super_admin() then
    raise exception 'only super admin may release a version';
  end if;
  if exists (select 1 from app_version where version = p_version) then
    raise exception 'version % already exists', p_version;
  end if;

  select rpc_version into v_rpc from app_runtime_config where id = true;

  insert into app_version (version, released_by, channel, rpc_version, deployment_url, config, summary)
  values (p_version, auth.uid(), p_channel, coalesce(v_rpc, 'v1'), p_deployment_url,
          _snapshot_permission_config(), p_summary);
end;
$function$;

-- --- 6. activate_version(): restore a version's config + rpc_version -------
-- Auto-snapshots current state first (as a restore point), so a bad
-- activation is itself reversible. All-or-nothing in one transaction.
create or replace function public.activate_version(p_version text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_target app_version;
  v_current_rpc text;
  v_cfg jsonb;
begin
  if not is_super_admin() then
    raise exception 'only super admin may activate a version';
  end if;

  select * into v_target from app_version where version = p_version;
  if not found then
    raise exception 'version % does not exist', p_version;
  end if;

  select rpc_version into v_current_rpc from app_runtime_config where id = true;

  -- Auto-snapshot current state before touching anything, so this is reversible.
  insert into app_restore_point (label, created_by, rpc_version, config, notes)
  values ('auto-before-activate-' || p_version, auth.uid(), coalesce(v_current_rpc, 'v1'),
          _snapshot_permission_config(), 'automatic snapshot taken by activate_version()');

  v_cfg := v_target.config;

  -- Replace the five shadow-mode tables from the target version's snapshot.
  delete from app_grant;
  delete from app_user_class;
  delete from app_node_edge;
  delete from app_node;
  delete from app_class;

  insert into app_class select * from jsonb_populate_recordset(null::app_class, v_cfg->'app_class');
  insert into app_node select * from jsonb_populate_recordset(null::app_node, v_cfg->'app_node');
  insert into app_node_edge select * from jsonb_populate_recordset(null::app_node_edge, v_cfg->'app_node_edge');
  insert into app_user_class select * from jsonb_populate_recordset(null::app_user_class, v_cfg->'app_user_class');
  insert into app_grant select * from jsonb_populate_recordset(null::app_grant, v_cfg->'app_grant');

  -- app_grant.id is restored with its ORIGINAL (bigserial) values from the snapshot, not
  -- freshly generated ones -- otherwise the id would change on every restore, breaking any
  -- external reference to a specific grant row. That means the sequence itself doesn't advance
  -- to match; without this, the next organic insert could collide with a restored id once the
  -- sequence catches up. Bump it past whatever was just restored.
  perform setval(pg_get_serial_sequence('app_grant', 'id'), coalesce((select max(id) from app_grant), 1), true);

  update app_runtime_config
    set active_version = p_version,
        rpc_version = v_target.rpc_version,
        updated_at = now(),
        updated_by = auth.uid()
    where id = true;
end;
$function$;

-- --- 7. mark_stable(): flip is_stable once a version has run clean --------
create or replace function public.mark_stable(p_version text)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update app_version set is_stable = true
  where version = p_version and is_super_admin()
$function$;

grant execute on function public.release_version(text, text, text, node_channel) to authenticated;
grant execute on function public.activate_version(text) to authenticated;
grant execute on function public.mark_stable(text) to authenticated;

-- --- 8. Declare the current app as version 1.0, marked stable --------------
-- Direct INSERT rather than calling release_version()/mark_stable(): those
-- RPCs correctly gate on is_super_admin(), but this migration runs without an
-- authenticated session (auth.uid() is null under direct SQL execution), so
-- calling them here would raise. The one-time bootstrap bypasses the RPC
-- since a migration already has elevated privileges by construction.
insert into app_version (version, released_by, channel, rpc_version, deployment_url, config, is_stable, summary)
select '1.0', null, 'stable', 'v1', null, _snapshot_permission_config(), true,
       'Baseline: Phase 2 permission engine + admin UI in shadow mode. No live RPC wiring yet.'
where not exists (select 1 from app_version where version = '1.0');
