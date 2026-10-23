-- Purchase insights, first screens: client card and item card (R&D, granted per user as the module "purchase_insights").
-- Built on purchase_facts (net sold / returned per company, client, item and month), clients, item_pricing, inventory,
-- stock_moves and stock_daily. Everything is scoped by the caller's access: own companies only, the years the user may
-- see (hidden years / this-year-only), and agent-limited users get nothing (purchase_facts has no agent column, so it
-- cannot be limited to an agent's clients). Quantities and cash only; no cost, no list price.
--
-- "Stopped buying" = bought in at least 3 different months of the window 4-15 months ago and not at all in the last 3 months.

create index if not exists purchase_facts_company_item
  on public.purchase_facts (company, item_sku, year, month);

-- Shared gate: the caller's access row when they may use these screens for the company, else null.
create or replace function public.purchase_cards_gate(p_company text)
returns dashboard_user_access
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare acc dashboard_user_access;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null or p_company is null or not (p_company = any(acc.companies)) then return null; end if;
  if acc.agents is not null and array_length(acc.agents, 1) is not null then return null; end if;
  if not (is_super_admin() or 'purchase_insights' = any(coalesce(acc.modules, '{}'))) then return null; end if;
  return acc;
end;
$function$;
revoke all on function public.purchase_cards_gate(text) from public, anon, authenticated;

create or replace function public.search_purchase_clients(p_company text, p_query text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; cur int; q text; res jsonb;
begin
  acc := purchase_cards_gate(p_company);
  if acc.user_id is null then return '[]'::jsonb; end if;
  cur := extract(year from (now() at time zone 'Asia/Jerusalem'))::int * 12 + extract(month from (now() at time zone 'Asia/Jerusalem'))::int;
  q := '%' || btrim(coalesce(p_query, '')) || '%';

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.client_id, 'name', r.name, 'city', r.city, 'cash12', r.cash12, 'last', r.last_date) order by r.cash12 desc nulls last, r.name), '[]'::jsonb)
    into res
  from (
    select f.client_id, max(c.name) as name, max(c.city) as city,
           sum(f.cash_sold - f.cash_returned) filter (where f.year * 12 + f.month > cur - 12) as cash12,
           max(f.last_date) as last_date
    from purchase_facts f
    left join clients c on c.company = f.company and c.erp_client_id = f.client_id
    where f.company = p_company
      and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (btrim(coalesce(p_query, '')) = '' or f.client_id ilike q or c.name ilike q)
    group by f.client_id
    order by cash12 desc nulls last
    limit 30
  ) r;
  return res;
end;
$function$;
grant execute on function public.search_purchase_clients(text, text) to authenticated;

create or replace function public.get_client_card(p_company text, p_client_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; cur int; res jsonb;
begin
  acc := purchase_cards_gate(p_company);
  if acc.user_id is null then return null; end if;
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
                 'agent', c.erp_agent_id, 'active', c.active,
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
grant execute on function public.get_client_card(text, text) to authenticated;

create or replace function public.search_purchase_items(p_company text, p_query text default '')
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; cur int; q text; res jsonb;
begin
  acc := purchase_cards_gate(p_company);
  if acc.user_id is null then return '[]'::jsonb; end if;
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
      and (btrim(coalesce(p_query, '')) = '' or f.item_sku ilike q or p.name ilike q or p.barcode ilike q)
    group by f.item_sku
    order by cash12 desc nulls last
    limit 30
  ) r;
  return res;
end;
$function$;
grant execute on function public.search_purchase_items(text, text) to authenticated;

create or replace function public.get_item_card(p_company text, p_sku text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; cur int; res jsonb;
begin
  acc := purchase_cards_gate(p_company);
  if acc.user_id is null then return null; end if;
  cur := extract(year from (now() at time zone 'Asia/Jerusalem'))::int * 12 + extract(month from (now() at time zone 'Asia/Jerusalem'))::int;

  with f as (
    select f.*, f.year * 12 + f.month as ym
    from purchase_facts f
    where f.company = p_company and f.item_sku = p_sku
      and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
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
grant execute on function public.get_item_card(text, text) to authenticated;
