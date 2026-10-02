-- ============================================================================
-- PHASE 2 — class/permission architecture, SHADOW MODE.
--
-- Nothing here is read by the live app yet. get_dashboard_access, the v1 RPCs,
-- and dashboard_user_access are completely unaffected. This migration adds new
-- tables and functions only; it is safe to apply against production.
-- ============================================================================

-- --- 1. Classes: named permission bundles -----------------------------------
create table if not exists app_class (
  id          text primary key,
  label       text not null,
  description text,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists app_user_class (
  user_id  uuid not null references user_profiles(id) on delete cascade,
  class_id text not null references app_class(id) on delete cascade,
  primary key (user_id, class_id)
);

-- --- 2. Grants: the ONE permission table ------------------------------------
do $$ begin
  create type grant_kind as enum ('scope','field','node');
exception when duplicate_object then null; end $$;

do $$ begin
  create type grant_effect as enum ('allow','deny');
exception when duplicate_object then null; end $$;

create table if not exists app_grant (
  id         bigserial primary key,
  class_id   text references app_class(id) on delete cascade,
  user_id    uuid references user_profiles(id) on delete cascade,
  kind       grant_kind not null,
  -- scope: dimension name ('company','agent','client','supplier')
  -- field:  field key     ('item_cost','client_profit','receipts')
  -- node:   node id       ('view.oversite','widget.top_items','dataset.sales_lines')
  key        text not null,
  -- scope only. NULL value  = ALL members of that dimension (wildcard).
  -- 'subtree'               = resolve via get_subtree_agent_ids(user)
  value      text,
  effect     grant_effect not null default 'allow',
  created_at timestamptz not null default now(),
  constraint app_grant_owner_ck
    check ((class_id is null) <> (user_id is null)),
  constraint app_grant_value_ck
    check (kind = 'scope' or value is null)
);

create index if not exists app_grant_class_idx on app_grant (class_id) where class_id is not null;
create index if not exists app_grant_user_idx  on app_grant (user_id)  where user_id  is not null;
create unique index if not exists app_grant_uniq
  on app_grant (coalesce(class_id,''), coalesce(user_id::text,''), kind, key, coalesce(value,'*'));

-- --- 3. Node registry: datasets, widgets, views -----------------------------
do $$ begin
  create type node_kind as enum ('dataset','widget','view');
exception when duplicate_object then null; end $$;

do $$ begin
  create type node_channel as enum ('stable','beta');
exception when duplicate_object then null; end $$;

create table if not exists app_node (
  id          text primary key,
  kind        node_kind not null,
  label       text not null,
  route       text,
  component   text,
  config      jsonb not null default '{}'::jsonb,
  channel     node_channel not null default 'stable',
  sort_order  int not null default 0,
  active      boolean not null default true,
  constraint app_node_shape_ck check (
    (kind = 'view'    and route is not null and component is null) or
    (kind = 'widget'  and component is not null) or
    (kind = 'dataset' and route is null and component is null)
  )
);

create table if not exists app_node_edge (
  parent_id  text not null references app_node(id) on delete cascade,
  child_id   text not null references app_node(id) on delete cascade,
  sort_order int not null default 0,
  config     jsonb not null default '{}'::jsonb,
  primary key (parent_id, child_id)
);

-- --- 4. RLS ------------------------------------------------------------------
alter table app_class      enable row level security;
alter table app_user_class enable row level security;
alter table app_grant      enable row level security;
alter table app_node       enable row level security;
alter table app_node_edge  enable row level security;

-- app_class / app_node / app_node_edge: super admin writes; any authenticated
-- user may read (needed for the client to render its own nav from app_node).
drop policy if exists app_class_select on app_class;
create policy app_class_select on app_class for select to authenticated using (true);
drop policy if exists app_class_write on app_class;
create policy app_class_write on app_class for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

drop policy if exists app_node_select on app_node;
create policy app_node_select on app_node for select to authenticated using (true);
drop policy if exists app_node_write on app_node;
create policy app_node_write on app_node for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

drop policy if exists app_node_edge_select on app_node_edge;
create policy app_node_edge_select on app_node_edge for select to authenticated using (true);
drop policy if exists app_node_edge_write on app_node_edge;
create policy app_node_edge_write on app_node_edge for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- app_user_class: admins may assign classes, but only to users in their own
-- subtree (get_subtree_ids). Super admin is unrestricted via is_super_admin().
drop policy if exists app_user_class_select on app_user_class;
create policy app_user_class_select on app_user_class for select to authenticated
  using (user_id = auth.uid() or is_super_admin() or is_admin_or_above());
drop policy if exists app_user_class_write on app_user_class;
create policy app_user_class_write on app_user_class for all to authenticated
  using (
    is_super_admin()
    or (is_admin_or_above() and user_id in (select get_subtree_ids(auth.uid())))
  )
  with check (
    is_super_admin()
    or (is_admin_or_above() and user_id in (select get_subtree_ids(auth.uid())))
  );

-- app_grant: nothing reads this table directly except resolve_access (SECURITY
-- DEFINER) and explain_access. Deny direct select/write to everyone except
-- super admin, who needs it for the admin UI.
drop policy if exists app_grant_select on app_grant;
create policy app_grant_select on app_grant for select to authenticated
  using (is_super_admin());
drop policy if exists app_grant_write on app_grant;
create policy app_grant_write on app_grant for all to authenticated
  using (is_super_admin()) with check (is_super_admin());

-- --- 5. The choke point ------------------------------------------------------
create or replace function public.resolve_access(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
stable
set search_path to 'public'
as $function$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_res jsonb;
begin
  -- Same caller check as the hardened get_dashboard_access: own row only,
  -- unless super admin. (20260813010000_harden_get_dashboard_access -- this
  -- leak already happened once, do not reintroduce it here.)
  if v_target is distinct from auth.uid() and not is_super_admin() then
    return null;
  end if;
  if not exists (select 1 from user_profiles where id = v_target and active) then
    return null;
  end if;

  with eff as (
    select g.kind, g.key, g.value, g.effect
      from app_grant g
      join app_user_class uc on uc.class_id = g.class_id and uc.user_id = v_target
     union all
    select g.kind, g.key, g.value, g.effect
      from app_grant g where g.user_id = v_target
  ),
  -- deny always wins over allow at the same (kind,key,value); a deny with
  -- value IS NULL also blocks a specific-value allow for that key (a
  -- dimension-wide deny overrides individual allows).
  net as (
    select kind, key, value from eff e
     where effect = 'allow'
       and not exists (
         select 1 from eff d
          where d.effect = 'deny' and d.kind = e.kind and d.key = e.key
            and (d.value is not distinct from e.value or d.value is null)
       )
  ),
  agents as (
    select distinct up.agent_erp_id as v
      from net n
      join user_profiles up
        on (n.value = 'subtree' and up.id in (select get_subtree_agent_ids(v_target)))
        or (n.value <> 'subtree' and up.agent_erp_id = n.value)
     where n.kind = 'scope' and n.key = 'agent' and n.value is not null
       and up.agent_erp_id is not null   -- NULL erp id => explicitly not in scope
  )
  select jsonb_build_object(
    'user_id',   v_target,
    'active',    true,
    'role',      (select role from user_profiles where id = v_target),
    'companies', (select coalesce(jsonb_agg(distinct value), '[]'::jsonb)
                    from net where kind = 'scope' and key = 'company' and value is not null),
    'companies_all', exists (select 1 from net where kind='scope' and key='company' and value is null),
    'agents',    (select coalesce(jsonb_agg(distinct v), '[]'::jsonb) from agents),
    'agents_all', exists (select 1 from net where kind='scope' and key='agent' and value is null),
    'fields',    (select coalesce(jsonb_agg(distinct key), '[]'::jsonb) from net where kind = 'field'),
    'nodes',     (select coalesce(jsonb_agg(distinct key), '[]'::jsonb) from net where kind = 'node')
  ) into v_res;

  return v_res;
end;
$function$;

grant execute on function public.resolve_access(uuid) to authenticated;

-- --- 6. Companions ------------------------------------------------------------
create or replace function public.has_field(p_acc jsonb, p_field text)
returns boolean
language sql
immutable
as $function$
  select coalesce(p_acc -> 'fields' ? p_field, false)
$function$;

create or replace function public.scope_companies(p_acc jsonb)
returns text[]
language sql
stable
set search_path to 'public'
as $function$
  select case
    when coalesce((p_acc->>'companies_all')::boolean, false)
      then array['pupik','mt','grow','gold']
    else array(select jsonb_array_elements_text(coalesce(p_acc->'companies','[]'::jsonb)))
  end
$function$;

create or replace function public.scope_agents(p_acc jsonb)
returns text[]
language sql
immutable
as $function$
  select array(select jsonb_array_elements_text(coalesce(p_acc->'agents','[]'::jsonb)))
$function$;

-- --- 7. Debugging escape hatch -- built now, not deferred --------------------
-- Every grant row that fed into a given (kind,key) decision for a user, its
-- source (a specific class, or 'user override'), and whether it survived the
-- deny-wins rule. This is what turns "why can't Ruth see debt?" from a SQL
-- session into an admin-UI popover.
create or replace function public.explain_access(
  p_user_id uuid,
  p_kind grant_kind,
  p_key text
)
returns table (source text, effect grant_effect, value text, winning boolean)
language plpgsql
security definer
stable
set search_path to 'public'
as $function$
begin
  if p_user_id is distinct from auth.uid() and not is_super_admin() then
    return;
  end if;

  return query
  with eff as (
    select coalesce('class:' || g.class_id, 'user override') as source,
           g.kind, g.key, g.value, g.effect
      from app_grant g
      join app_user_class uc on uc.class_id = g.class_id and uc.user_id = p_user_id
     where g.kind = p_kind and g.key = p_key
     union all
    select 'user override', g.kind, g.key, g.value, g.effect
      from app_grant g
     where g.user_id = p_user_id and g.kind = p_kind and g.key = p_key
  )
  select e.source, e.effect, e.value,
    (e.effect = 'allow' and not exists (
       select 1 from eff d
        where d.effect = 'deny'
          and (d.value is not distinct from e.value or d.value is null)
     )) as winning
  from eff e
  order by e.effect desc, e.source;
end;
$function$;

grant execute on function public.explain_access(uuid, grant_kind, text) to authenticated;
