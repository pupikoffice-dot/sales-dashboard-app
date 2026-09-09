-- Intercompany user link: one person who holds two separate ERP agent
-- identities in two different companies (case in point: Or is agent 25 in
-- Pupik and agent 57 in Monkeytime, as two distinct dashboard logins).
--
-- Design note — why this is a *switch* and not a merge. dashboard_user_access
-- stores `companies` and `agents` as two independent arrays that every filter
-- applies as a cross-product. Merging Or into companies={pupik,mt} and
-- agents={25,57} would therefore also expose Monkeytime's agent 25 and Pupik's
-- agent 57 to him. So the two access rows stay untouched and we switch which
-- one is in force, meaning exactly one company/agent scope is ever active.
--
-- Design note — why get_dashboard_access. Every data path
-- (get_dashboard_sales_range, get_dashboard_sales_boundaries,
-- get_dashboard_aux) resolves scope through get_dashboard_access(auth.uid()),
-- so teaching that single function to serve the linked row propagates the
-- switch everywhere without altering any of the data RPC signatures.
--
-- Back-compatible by construction: with no rows in dashboard_user_link_active,
-- get_dashboard_access behaves exactly as before, so production is unaffected
-- until a link is actually created by a super admin.

-- Which accounts belong to the same person. Stored in both directions so
-- either login can switch to the other; the admin API writes the pair.
create table if not exists public.dashboard_user_link (
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  linked_user_id uuid not null references public.user_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, linked_user_id),
  constraint dashboard_user_link_no_self check (user_id <> linked_user_id)
);

comment on table public.dashboard_user_link is
  'Peer dashboard accounts belonging to one person across companies. Symmetric: both directions are stored.';

alter table public.dashboard_user_link enable row level security;

-- A user may see who they are linked to (needed to render the switcher).
drop policy if exists dashboard_user_link_select on public.dashboard_user_link;
create policy dashboard_user_link_select on public.dashboard_user_link
  for select to authenticated
  using (user_id = auth.uid() or is_super_admin());

-- Only a super admin may create or remove links.
drop policy if exists dashboard_user_link_write on public.dashboard_user_link;
create policy dashboard_user_link_write on public.dashboard_user_link
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- Which linked identity a user is currently viewing. Absent row = own identity.
-- Server-side rather than client-side so it cannot be spoofed and so the
-- scope the RPCs apply always matches what the UI claims to be showing.
create table if not exists public.dashboard_user_link_active (
  user_id uuid primary key references public.user_profiles(id) on delete cascade,
  active_as_user_id uuid not null references public.user_profiles(id) on delete cascade,
  updated_at timestamptz not null default now()
);

comment on table public.dashboard_user_link_active is
  'Currently active linked identity per user. Written only via set_active_intercompany_identity, which validates the link.';

alter table public.dashboard_user_link_active enable row level security;

drop policy if exists dashboard_user_link_active_select on public.dashboard_user_link_active;
create policy dashboard_user_link_active_select on public.dashboard_user_link_active
  for select to authenticated
  using (user_id = auth.uid() or is_super_admin());

-- Deliberately no direct write policy for the owner: an unvalidated write here
-- would be privilege escalation (any uuid = any company). Writes go through
-- set_active_intercompany_identity, which checks dashboard_user_link first.
drop policy if exists dashboard_user_link_active_write on public.dashboard_user_link_active;
create policy dashboard_user_link_active_write on public.dashboard_user_link_active
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

-- Identities available to the caller in the top-bar switcher: their own plus
-- every account linked to them. Returns zero rows when the caller has no
-- links, which is how the UI decides to hide the switcher entirely.
create or replace function public.get_intercompany_identities()
 returns table (
   user_id uuid,
   name text,
   username text,
   agent_erp_id text,
   companies text[],
   is_self boolean,
   is_active boolean
 )
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with links as (
    select l.linked_user_id as uid
    from dashboard_user_link l
    join user_profiles p on p.id = l.linked_user_id and p.active
    where l.user_id = auth.uid()
  ),
  ids as (
    select uid, false as is_self from links
    union all
    select auth.uid(), true where exists (select 1 from links)
  ),
  act as (
    -- Re-checks the link so revoking it takes effect immediately, even if a
    -- stale active row is left behind.
    select a.active_as_user_id as uid
    from dashboard_user_link_active a
    join dashboard_user_link l
      on l.user_id = a.user_id and l.linked_user_id = a.active_as_user_id
    where a.user_id = auth.uid()
  )
  select
    i.uid,
    p.name,
    p.username,
    p.agent_erp_id,
    coalesce(acc.companies, '{}'::text[]),
    i.is_self,
    case
      when (select uid from act) is null then i.is_self
      else i.uid = (select uid from act)
    end
  from ids i
  join user_profiles p on p.id = i.uid
  left join dashboard_user_access acc on acc.user_id = i.uid
  order by i.is_self desc, p.name;
$function$;

revoke all on function public.get_intercompany_identities() from public, anon;
grant execute on function public.get_intercompany_identities() to authenticated;

-- Switch the caller to one of their linked identities. Passing null or their
-- own id returns them to their own account.
create or replace function public.set_active_intercompany_identity(p_user_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_user_id is null or p_user_id = auth.uid() then
    delete from dashboard_user_link_active where user_id = auth.uid();
    return;
  end if;

  if not exists (
    select 1 from dashboard_user_link
    where user_id = auth.uid() and linked_user_id = p_user_id
  ) then
    raise exception 'no intercompany link from % to %', auth.uid(), p_user_id;
  end if;

  insert into dashboard_user_link_active (user_id, active_as_user_id)
  values (auth.uid(), p_user_id)
  on conflict (user_id) do update
    set active_as_user_id = excluded.active_as_user_id,
        updated_at = now();
end;
$function$;

revoke all on function public.set_active_intercompany_identity(uuid) from public, anon;
grant execute on function public.set_active_intercompany_identity(uuid) to authenticated;

-- Serve the linked account's access row while a switch is in force.
-- Everything else is byte-for-byte the previous definition.
create or replace function public.get_dashboard_access(p_user_id uuid DEFAULT auth.uid())
 RETURNS dashboard_user_access
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  row dashboard_user_access;
  target uuid := p_user_id;
begin
  -- Only your own row, unless you are a super admin.
  if p_user_id is distinct from auth.uid() and not is_super_admin() then
    return null;
  end if;

  -- Intercompany switch. Applied only when you are looking up your own row, so
  -- the admin screens keep showing a user's real, unswitched configuration.
  if p_user_id = auth.uid() then
    select a.active_as_user_id into target
    from dashboard_user_link_active a
    join dashboard_user_link l
      on l.user_id = a.user_id and l.linked_user_id = a.active_as_user_id
    where a.user_id = auth.uid();
    if target is null then
      target := p_user_id;
    end if;
  end if;

  select * into row from dashboard_user_access where user_id = target;
  if found then return row; end if;

  if is_super_admin() and p_user_id = auth.uid() then
    row.user_id := p_user_id;
    row.modules := array(select id from dashboard_modules order by sort_order);
    row.companies := array['pupik','mt','grow','gold'];
    row.agents := null;
    row.default_module := 'oversite';
    row.active := true;
    row.show_item_cost := true;
    row.show_client_profit := true;
    row.oversite_modules := array[
      'ordersToday','ordersMtd','openOrders','salesMtd','topItems',
      'suppliers','returns','debt','receipts','stockAlerts'
    ];
    return row;
  end if;
  return null;
end;
$function$;
