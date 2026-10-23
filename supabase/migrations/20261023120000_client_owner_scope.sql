-- Agent-scoped client and item cards. A client belongs to one agent at a time: the agent on the client master
-- (clients.erp_agent_id), or, when the master has none, the agent on the client's latest invoice line. A user limited to
-- agents (an agent, or a sales manager holding several) sees only the clients those agents own, in every company they
-- may open; everyone else is unchanged. The item card of an agent-limited user counts only his own clients' purchases.
--
-- "View as": the functions take an optional p_as (the user being previewed). It is honoured only for a super admin, so
-- the owner can test exactly what an agent would get.

drop function if exists public.purchase_cards_gate(text);
drop function if exists public.search_purchase_clients(text, text);
drop function if exists public.get_client_card(text, text);
drop function if exists public.search_purchase_items(text, text);
drop function if exists public.get_item_card(text, text);

-- One owner per client of the company (clients that appear in purchase_facts).
create or replace function public.client_owner_v(p_company text)
returns table (client_id text, agent_id text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with base as (
    select distinct pf.client_id as cid from purchase_facts pf where pf.company = p_company
  ),
  m as (
    select distinct on (c.erp_client_id) c.erp_client_id as cid, nullif(btrim(c.erp_agent_id), '') as agent
    from clients c where c.company = p_company
    order by c.erp_client_id, c.updated_at desc nulls last
  ),
  need as (
    select b.cid from base b left join m on m.cid = b.cid where m.agent is null
  ),
  fb as (
    select distinct on (s.client_id) s.client_id as cid, s.agent_erp_id as agent
    from sales_lines s
    where s.company = p_company and s.client_id in (select cid from need)
      and s.line_source like 'rep891%' and coalesce(s.agent_erp_id, '') <> ''
    order by s.client_id, s.line_date desc
  )
  select b.cid, coalesce(m.agent, fb.agent)
  from base b
  left join m on m.cid = b.cid
  left join fb on fb.cid = b.cid;
$function$;
revoke all on function public.client_owner_v(text) from public, anon, authenticated;

-- The same for one client.
create or replace function public.client_owner_of(p_company text, p_client_id text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    nullif(btrim((select c.erp_agent_id from clients c
                   where c.company = p_company and c.erp_client_id = p_client_id
                   order by c.updated_at desc nulls last limit 1)), ''),
    (select s.agent_erp_id from sales_lines s
      where s.company = p_company and s.client_id = p_client_id
        and s.line_source like 'rep891%' and coalesce(s.agent_erp_id, '') <> ''
      order by s.line_date desc limit 1));
$function$;
revoke all on function public.client_owner_of(text, text) from public, anon, authenticated;

-- Gate: the access row the screens act under, or null.
create or replace function public.purchase_cards_gate(p_company text, p_as uuid default null)
returns dashboard_user_access
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare acc dashboard_user_access; previewing boolean;
begin
  previewing := p_as is not null and p_as <> auth.uid() and is_super_admin();
  acc := get_dashboard_access(case when previewing then p_as else auth.uid() end);
  if acc.user_id is null or p_company is null or not (p_company = any(acc.companies)) then return null; end if;
  if not ((not previewing and is_super_admin()) or 'purchase_insights' = any(coalesce(acc.modules, '{}'))) then return null; end if;
  return acc;
end;
$function$;
revoke all on function public.purchase_cards_gate(text, uuid) from public, anon, authenticated;

create or replace function public.search_purchase_clients(p_company text, p_query text default '', p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; cur int; q text; lim boolean; res jsonb;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null then return '[]'::jsonb; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  cur := extract(year from (now() at time zone 'Asia/Jerusalem'))::int * 12 + extract(month from (now() at time zone 'Asia/Jerusalem'))::int;
  q := '%' || btrim(coalesce(p_query, '')) || '%';

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.client_id, 'name', r.name, 'city', r.city, 'agent', r.agent, 'cash12', r.cash12, 'last', r.last_date)
           order by r.cash12 desc nulls last, r.name), '[]'::jsonb)
    into res
  from (
    select f.client_id, max(c.name) as name, max(c.city) as city, max(o.agent_id) as agent,
           sum(f.cash_sold - f.cash_returned) filter (where f.year * 12 + f.month > cur - 12) as cash12,
           max(f.last_date) as last_date
    from purchase_facts f
    join client_owner_v(p_company) o on o.client_id = f.client_id
    left join clients c on c.company = f.company and c.erp_client_id = f.client_id
    where f.company = p_company
      and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (not lim or o.agent_id = any(acc.agents))
      and (btrim(coalesce(p_query, '')) = '' or f.client_id ilike q or c.name ilike q)
    group by f.client_id
    order by cash12 desc nulls last
    limit 30
  ) r;
  return res;
end;
$function$;
grant execute on function public.search_purchase_clients(text, text, uuid) to authenticated;

create or replace function public.get_client_card(p_company text, p_client_id text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; cur int; lim boolean; owner text; res jsonb;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  owner := client_owner_of(p_company, p_client_id);
  if lim and (owner is null or not (owner = any(acc.agents))) then return null; end if;
  cur := extract(year from (now() at time zone 'Asia/Jerusalem'))::int * 12 + extract(month from (now() at time zone 'Asia/Jerusalem'))::int;

  with f as (
    select f.*, f.year * 12 + f.month as ym
    from purchase_facts f
    where f.company = p_company and f.client_id = p_client_id
      and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
  ),
  named as (
    select f.*, coalesce(nullif(p.name, ''), f.item_sku) as item_name,
           case when left(f.item_sku, 1) = '*' or upper(split_part(f.item_sku, '-', 1)) ~ '^[0-9]+$' then 'Other'
                else coalesce(sp.supplier_name, nullif(upper(split_part(f.item_sku, '-', 1)), ''), '(no brand)') end as brand
    from f
    left join item_pricing p on p.company = f.company and p.sku = f.item_sku
    left join supplier_prefix sp on sp.prefix = upper(split_part(f.item_sku, '-', 1))
  ),
  months as (
    select year, month, sum(cash_sold - cash_returned) as cash, sum(qty_sold - qty_returned) as qty
    from f where ym > cur - 24 group by year, month
  ),
  years as (
    select year, sum(cash_sold) as sold, sum(cash_returned) as returned, sum(qty_sold - qty_returned) as qty
    from f group by year
  ),
  top_items as (
    select item_sku, max(item_name) as name, sum(qty_sold - qty_returned) as qty, sum(cash_sold - cash_returned) as cash,
           count(distinct ym) as months_bought, max(last_date) as last_date
    from named where ym > cur - 12 group by item_sku
    order by cash desc nulls last limit 15
  ),
  top_brands as (
    select brand, sum(cash_sold - cash_returned) as cash
    from named where ym > cur - 12 group by brand
    order by cash desc nulls last limit 8
  ),
  stopped as (
    select item_sku, max(item_name) as name, sum(qty_sold) filter (where ym <= cur - 3) as qty,
           sum(cash_sold - cash_returned) filter (where ym <= cur - 3) as cash,
           count(distinct ym) filter (where ym between cur - 14 and cur - 3) as months_bought,
           max(last_date) as last_date
    from named
    group by item_sku
    having count(distinct ym) filter (where ym between cur - 14 and cur - 3) >= 3
       and not exists (select 1 from named n2 where n2.item_sku = named.item_sku and n2.ym > cur - 3 and n2.qty_sold > 0)
    order by sum(cash_sold - cash_returned) filter (where ym <= cur - 3) desc nulls last
    limit 15
  )
  select jsonb_build_object(
    'client', (select jsonb_build_object('id', p_client_id, 'name', c.name, 'city', c.city, 'region', c.region,
                 'agent', owner, 'active', c.active,
                 'chain', (select ch.name from client_chains cc join chains ch on ch.id = cc.chain_id
                           where cc.company = p_company and cc.client_id = p_client_id limit 1),
                 'intergroup', exists (select 1 from intergroup_clients g where g.company = p_company and g.client_id = p_client_id))
               from (select 1) x left join clients c on c.company = p_company and c.erp_client_id = p_client_id),
    'first', (select min(first_date) from f),
    'last', (select max(last_date) from f),
    'docs12', (select coalesce(sum(docs_sold), 0) from f where ym > cur - 12),
    'sold12', (select coalesce(sum(cash_sold), 0) from f where ym > cur - 12),
    'returned12', (select coalesce(sum(cash_returned), 0) from f where ym > cur - 12),
    'months', (select coalesce(jsonb_agg(jsonb_build_object('y', year, 'm', month, 'cash', cash, 'qty', qty) order by year, month), '[]'::jsonb) from months),
    'years', (select coalesce(jsonb_agg(jsonb_build_object('y', year, 'sold', sold, 'returned', returned, 'qty', qty) order by year), '[]'::jsonb) from years),
    'topItems', (select coalesce(jsonb_agg(jsonb_build_object('sku', item_sku, 'name', name, 'qty', qty, 'cash', cash,
                   'months', months_bought, 'last', last_date) order by cash desc nulls last), '[]'::jsonb) from top_items),
    'topBrands', (select coalesce(jsonb_agg(jsonb_build_object('brand', brand, 'cash', cash) order by cash desc nulls last), '[]'::jsonb) from top_brands),
    'stopped', (select coalesce(jsonb_agg(jsonb_build_object('sku', item_sku, 'name', name, 'qty', qty, 'cash', cash,
                   'months', months_bought, 'last', last_date) order by cash desc nulls last), '[]'::jsonb) from stopped)
  ) into res;
  return res;
end;
$function$;
grant execute on function public.get_client_card(text, text, uuid) to authenticated;

create or replace function public.search_purchase_items(p_company text, p_query text default '', p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; cur int; q text; lim boolean; mine text[]; res jsonb;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null then return '[]'::jsonb; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  if lim then
    select coalesce(array_agg(o.client_id), '{}') into mine from client_owner_v(p_company) o where o.agent_id = any(acc.agents);
  end if;
  cur := extract(year from (now() at time zone 'Asia/Jerusalem'))::int * 12 + extract(month from (now() at time zone 'Asia/Jerusalem'))::int;
  q := '%' || btrim(coalesce(p_query, '')) || '%';

  select coalesce(jsonb_agg(jsonb_build_object('sku', r.item_sku, 'name', r.name, 'qty12', r.qty12, 'cash12', r.cash12, 'clients12', r.clients12)
                            order by r.cash12 desc nulls last, r.item_sku), '[]'::jsonb)
    into res
  from (
    select f.item_sku, max(coalesce(nullif(p.name, ''), f.item_sku)) as name,
           sum(f.qty_sold - f.qty_returned) filter (where f.year * 12 + f.month > cur - 12) as qty12,
           sum(f.cash_sold - f.cash_returned) filter (where f.year * 12 + f.month > cur - 12) as cash12,
           count(distinct f.client_id) filter (where f.year * 12 + f.month > cur - 12 and f.qty_sold > 0) as clients12
    from purchase_facts f
    left join item_pricing p on p.company = f.company and p.sku = f.item_sku
    where f.company = p_company
      and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (not lim or f.client_id = any(mine))
      and (btrim(coalesce(p_query, '')) = '' or f.item_sku ilike q or p.name ilike q or p.barcode ilike q)
    group by f.item_sku
    order by cash12 desc nulls last
    limit 30
  ) r;
  return res;
end;
$function$;
grant execute on function public.search_purchase_items(text, text, uuid) to authenticated;

create or replace function public.get_item_card(p_company text, p_sku text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; cur int; lim boolean; mine text[]; res jsonb;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  if lim then
    select coalesce(array_agg(o.client_id), '{}') into mine from client_owner_v(p_company) o where o.agent_id = any(acc.agents);
  end if;
  cur := extract(year from (now() at time zone 'Asia/Jerusalem'))::int * 12 + extract(month from (now() at time zone 'Asia/Jerusalem'))::int;

  with f as (
    select f.*, f.year * 12 + f.month as ym
    from purchase_facts f
    where f.company = p_company and f.item_sku = p_sku
      and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (not lim or f.client_id = any(mine))
  ),
  named as (
    select f.*, coalesce(nullif(c.name, ''), f.client_id) as client_name
    from f left join clients c on c.company = f.company and c.erp_client_id = f.client_id
  ),
  months as (
    select year, month, sum(qty_sold) as sold, sum(qty_returned) as returned, sum(cash_sold - cash_returned) as cash
    from f where ym > cur - 24 group by year, month
  ),
  top_clients as (
    select client_id, max(client_name) as name, sum(qty_sold - qty_returned) as qty, sum(cash_sold - cash_returned) as cash,
           count(distinct ym) as months_bought, max(last_date) as last_date
    from named where ym > cur - 12 group by client_id
    order by cash desc nulls last limit 15
  ),
  stopped as (
    select client_id, max(client_name) as name, sum(qty_sold) filter (where ym <= cur - 3) as qty,
           sum(cash_sold - cash_returned) filter (where ym <= cur - 3) as cash,
           count(distinct ym) filter (where ym between cur - 14 and cur - 3) as months_bought, max(last_date) as last_date
    from named
    group by client_id
    having count(distinct ym) filter (where ym between cur - 14 and cur - 3) >= 3
       and not exists (select 1 from named n2 where n2.client_id = named.client_id and n2.ym > cur - 3 and n2.qty_sold > 0)
    order by sum(cash_sold - cash_returned) filter (where ym <= cur - 3) desc nulls last
    limit 15
  )
  select jsonb_build_object(
    'scoped', lim,
    'item', (select jsonb_build_object('sku', p_sku,
                 'name', coalesce(nullif(p.name, ''), p_sku), 'barcode', p.barcode,
                 'brand', case when left(p_sku, 1) = '*' or upper(split_part(p_sku, '-', 1)) ~ '^[0-9]+$' then 'Other'
                               else coalesce(sp.supplier_name, nullif(upper(split_part(p_sku, '-', 1)), ''), '(no brand)') end)
             from (select 1) x
             left join item_pricing p on p.company = p_company and p.sku = p_sku
             left join supplier_prefix sp on sp.prefix = upper(split_part(p_sku, '-', 1))),
    'stock', (select coalesce(sum(qty_on_hand), 0) from inventory where company = p_company and sku = p_sku),
    'sold12', (select coalesce(sum(qty_sold), 0) from f where ym > cur - 12),
    'returned12', (select coalesce(sum(qty_returned), 0) from f where ym > cur - 12),
    'sold3', (select coalesce(sum(qty_sold - qty_returned), 0) from f where ym > cur - 3),
    'clients12', (select count(distinct client_id) from f where ym > cur - 12 and qty_sold > 0),
    'first', (select min(first_date) from f),
    'last', (select max(last_date) from f),
    'months', (select coalesce(jsonb_agg(jsonb_build_object('y', year, 'm', month, 'sold', sold, 'returned', returned, 'cash', cash) order by year, month), '[]'::jsonb) from months),
    'topClients', (select coalesce(jsonb_agg(jsonb_build_object('id', client_id, 'name', name, 'qty', qty, 'cash', cash,
                      'months', months_bought, 'last', last_date) order by cash desc nulls last), '[]'::jsonb) from top_clients),
    'stopped', (select coalesce(jsonb_agg(jsonb_build_object('id', client_id, 'name', name, 'qty', qty, 'cash', cash,
                      'months', months_bought, 'last', last_date) order by cash desc nulls last), '[]'::jsonb) from stopped),
    'moves', (select coalesce(jsonb_agg(jsonb_build_object('date', move_date, 'kind', move_kind, 'qty', qty, 'doc', doc_num)
                      order by move_date desc), '[]'::jsonb)
              from (select * from stock_moves where company = p_company and item_sku = p_sku order by move_date desc limit 12) m),
    'stockDaily', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'qty', close_qty, 'est', estimated) order by day), '[]'::jsonb)
                   from stock_daily where company = p_company and sku = p_sku and day >= (now() at time zone 'Asia/Jerusalem')::date - 150)
  ) into res;
  return res;
end;
$function$;
grant execute on function public.get_item_card(text, text, uuid) to authenticated;
