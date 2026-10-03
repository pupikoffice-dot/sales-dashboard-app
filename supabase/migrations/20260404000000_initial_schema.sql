-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Types ───────────────────────────────────────────────────────────────────
create type user_role as enum ('super_admin', 'admin', 'manager', 'agent');
create type sync_status as enum ('running', 'success', 'failed');
create type sync_trigger as enum ('cron', 'admin', 'agent');
create type ai_provider_type as enum ('gemini', 'claude', 'openai');

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- user_profiles: unified table for all human users (super_admin, admin, manager, agent)
-- id mirrors auth.users.id so every user has exactly one profile
create table user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  name         text not null,
  role         user_role not null default 'agent',
  parent_id    uuid references user_profiles(id) on delete set null,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- clients: synced from ERP, assigned to agents
create table clients (
  id               uuid primary key default gen_random_uuid(),
  erp_client_id    text not null,
  name             text not null,
  company          text not null check (company in ('pupik', 'mt', 'grow')),
  assigned_agent_id uuid references user_profiles(id) on delete set null,
  phone            text,
  email            text,
  region           text,
  active           boolean not null default true,
  updated_at       timestamptz not null default now(),
  unique (erp_client_id, company)
);

-- sales_lines: ERP sales transaction rows (from ExportDashboardData.bas field spec)
create table sales_lines (
  id           bigserial primary key,
  line_date    date not null,
  year         smallint not null,
  month        smallint not null,
  agent_erp_id text,
  client_id    text not null,
  client_name  text,
  doc_type     text,
  doc_num      text,
  item_sku     text,
  barcode      text,
  item_name    text,
  qty          numeric,
  cash         numeric,
  tablet_cat   text,
  group_cat    text,
  supplier     text,
  brand        text,
  company      text not null check (company in ('pupik', 'mt', 'grow')),
  synced_at    timestamptz not null default now()
);

create index sales_lines_client_idx  on sales_lines (client_id);
create index sales_lines_agent_idx   on sales_lines (agent_erp_id);
create index sales_lines_date_idx    on sales_lines (line_date desc);
create index sales_lines_company_idx on sales_lines (company);

-- inventory: current stock from ERP (wmsRows)
create table inventory (
  id           bigserial primary key,
  sku          text not null,
  name         text,
  qty_on_hand  numeric not null default 0,
  company      text not null check (company in ('pupik', 'mt', 'grow')),
  synced_at    timestamptz not null default now(),
  unique (sku, company)
);

-- sku_pricing: pricing data from ERP (costRows / priceRows)
create table sku_pricing (
  id          bigserial primary key,
  sku         text not null,
  cost        numeric,
  list_price  numeric,
  company     text not null check (company in ('pupik', 'mt', 'grow')),
  synced_at   timestamptz not null default now(),
  unique (sku, company)
);

-- sync_logs: audit trail for every sync run
create table sync_logs (
  id           uuid primary key default gen_random_uuid(),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       sync_status not null default 'running',
  rows_updated integer,
  error_message text,
  triggered_by sync_trigger not null default 'cron'
);

-- app_settings: key/value config managed by super_admin from admin web app
create table app_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references user_profiles(id) on delete set null
);

-- agent_devices: device registry for security tracking and remote revocation
create table agent_devices (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid not null references user_profiles(id) on delete cascade,
  device_fingerprint text not null,
  device_model      text,
  android_version   text,
  app_version       text,
  registered_at     timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  revoked           boolean not null default false,
  revoked_by        uuid references user_profiles(id) on delete set null,
  revoked_at        timestamptz,
  unique (agent_id, device_fingerprint)
);

-- query_logs: tracks per-agent AI usage for cost monitoring
create table query_logs (
  id         bigserial primary key,
  agent_id   uuid not null references user_profiles(id) on delete cascade,
  provider   ai_provider_type not null,
  model      text not null,
  tokens_in  integer,
  tokens_out integer,
  created_at timestamptz not null default now()
);

create index query_logs_agent_idx on query_logs (agent_id);
create index query_logs_date_idx  on query_logs (created_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table user_profiles  enable row level security;
alter table clients        enable row level security;
alter table sales_lines    enable row level security;
alter table inventory      enable row level security;
alter table sku_pricing    enable row level security;
alter table sync_logs      enable row level security;
alter table app_settings   enable row level security;
alter table agent_devices  enable row level security;
alter table query_logs     enable row level security;

-- ─── Helper Functions ────────────────────────────────────────────────────────

-- Returns the calling user's role
create or replace function get_my_role()
returns user_role language sql security definer stable as $$
  select role from user_profiles where id = auth.uid()
$$;

-- Returns true if the calling user is super_admin
create or replace function is_super_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from user_profiles where id = auth.uid() and role = 'super_admin')
$$;

-- Returns true if the calling user is admin or above
create or replace function is_admin_or_above()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_profiles
    where id = auth.uid() and role in ('super_admin', 'admin')
  )
$$;

-- Returns true if the calling user is manager or above
create or replace function is_manager_or_above()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_profiles
    where id = auth.uid() and role in ('super_admin', 'admin', 'manager')
  )
$$;

-- Returns all agent IDs that fall under the given user's subtree
create or replace function get_subtree_agent_ids(p_user_id uuid)
returns setof uuid language sql security definer stable as $$
  with recursive subtree as (
    select id, role from user_profiles where id = p_user_id
    union all
    select up.id, up.role
    from user_profiles up
    join subtree s on up.parent_id = s.id
  )
  select id from subtree where role = 'agent'
$$;

-- Returns all user IDs in the calling user's subtree (for admin views)
create or replace function get_subtree_ids(p_user_id uuid)
returns setof uuid language sql security definer stable as $$
  with recursive subtree as (
    select id from user_profiles where parent_id = p_user_id
    union all
    select up.id
    from user_profiles up
    join subtree s on up.parent_id = s.id
  )
  select id from subtree
$$;

grant execute on function get_my_role()           to authenticated;
grant execute on function is_super_admin()        to authenticated;
grant execute on function is_admin_or_above()     to authenticated;
grant execute on function is_manager_or_above()   to authenticated;
grant execute on function get_subtree_agent_ids   to authenticated;
grant execute on function get_subtree_ids         to authenticated;

-- ─── RLS Policies ────────────────────────────────────────────────────────────

-- user_profiles
-- Users can read their own profile; super_admin sees all; others see their subtree
create policy "profiles_select_own" on user_profiles
  for select to authenticated
  using (
    id = auth.uid()
    or is_super_admin()
    or id in (select get_subtree_ids(auth.uid()))
  );

create policy "profiles_insert_admin" on user_profiles
  for insert to authenticated
  with check (is_manager_or_above());

create policy "profiles_update_own" on user_profiles
  for update to authenticated
  using (
    id = auth.uid()
    or is_super_admin()
    or id in (select get_subtree_ids(auth.uid()))
  );

-- Only super_admin can delete; cannot delete self
create policy "profiles_delete_super" on user_profiles
  for delete to authenticated
  using (is_super_admin() and id <> auth.uid());

-- clients
create policy "clients_select" on clients
  for select to authenticated
  using (
    is_admin_or_above()
    or assigned_agent_id = auth.uid()
    or assigned_agent_id in (select get_subtree_agent_ids(auth.uid()))
  );

create policy "clients_write" on clients
  for all to authenticated
  using (is_admin_or_above())
  with check (is_admin_or_above());

-- sales_lines: agents see rows matching their assigned clients; managers+ see subtree
create policy "sales_select_agent" on sales_lines
  for select to authenticated
  using (
    is_admin_or_above()
    or client_id in (
      select erp_client_id from clients
      where assigned_agent_id = auth.uid()
    )
    or client_id in (
      select erp_client_id from clients
      where assigned_agent_id in (select get_subtree_agent_ids(auth.uid()))
    )
  );

-- inventory and sku_pricing: all authenticated users can read (no sensitive data)
create policy "inventory_select" on inventory
  for select to authenticated using (true);

create policy "sku_pricing_select" on sku_pricing
  for select to authenticated using (true);

-- sync_logs: managers+ can read; only service role writes
create policy "sync_logs_select" on sync_logs
  for select to authenticated
  using (is_manager_or_above());

-- app_settings: all authenticated users can read; only super_admin can write
create policy "settings_select" on app_settings
  for select to authenticated using (true);

create policy "settings_write" on app_settings
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- agent_devices: agents see/update their own; admin+ see all
create policy "devices_select" on agent_devices
  for select to authenticated
  using (
    agent_id = auth.uid()
    or is_admin_or_above()
    or agent_id in (select get_subtree_agent_ids(auth.uid()))
  );

create policy "devices_insert_own" on agent_devices
  for insert to authenticated
  with check (agent_id = auth.uid());

create policy "devices_update" on agent_devices
  for update to authenticated
  using (
    agent_id = auth.uid()
    or is_admin_or_above()
  );

-- query_logs: agents see own; admin+ see all
create policy "query_logs_select" on query_logs
  for select to authenticated
  using (
    agent_id = auth.uid()
    or is_admin_or_above()
    or agent_id in (select get_subtree_agent_ids(auth.uid()))
  );

-- ─── Seed app_settings defaults ──────────────────────────────────────────────
insert into app_settings (key, value) values
  ('ai_provider',            'gemini'),
  ('ai_model',               'gemini-2.5-flash'),
  ('queries_per_agent_limit','500'),
  ('max_devices_per_agent',  '3')
on conflict (key) do nothing;
