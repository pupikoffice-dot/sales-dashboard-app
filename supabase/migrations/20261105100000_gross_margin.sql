-- Gross margin for the R&D reports (monthly, yearly overview, year detail, client card, item card, search sales).
-- Margin = net sales - net qty x unit cost, only over sales whose item has a cost; the companion RPCs return 'covered'
-- (the net sales that had a cost) so coverage = covered / net. Items without a cost are excluded, never treated as zero.
-- Cost basis: unit cost of an item for a year = average import cost (value / qty of its move_kind = 'import' stock_moves that year,
-- lines with qty > 0 and value > 0); if the item had no import that year, its current cost (item_pricing_admin.cost > 0); else no cost.
-- Visibility: only users with show_item_cost, or a real super admin (while previewing another user, that user's flag decides).
-- Everyone else gets null from the companion RPCs and null cost fields in get_client_item_sales. Existing RPC shapes are kept.

create or replace function public.gm_can_see_cost(acc dashboard_user_access, p_as uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(acc.show_item_cost, false)
      or (is_super_admin() and (p_as is null or p_as = auth.uid()));
$$;
revoke all on function public.gm_can_see_cost(dashboard_user_access, uuid) from public, anon, authenticated;

-- Unit cost per (item, year) for a company. Internal only.
create or replace function public.gm_unit_cost(p_company text)
returns table(item_sku text, year int, unit_cost numeric, basis text)
language sql
stable
security definer
set search_path to 'public'
as $$
  with yrs as (select distinct f.item_sku, f.year::int as year from purchase_facts f where f.company = p_company),
  imp as (
    select m.item_sku, extract(year from m.move_date)::int as year, sum(m.cash) / sum(m.qty) as uc
    from stock_moves m
    where m.company = p_company and m.move_kind = 'import' and m.qty > 0 and m.cash > 0
    group by 1, 2
  ),
  cur as (select a.sku, a.cost from item_pricing_admin a where a.company = p_company and a.cost > 0)
  select y.item_sku, y.year, coalesce(i.uc, c.cost) as unit_cost,
         case when i.uc is not null then 'import' else 'current' end as basis
  from yrs y
  left join imp i on i.item_sku = y.item_sku and i.year = y.year
  left join cur c on c.sku = y.item_sku
  where coalesce(i.uc, c.cost) is not null;
$$;
revoke all on function public.gm_unit_cost(text) from public, anon, authenticated;

-- Yearly overview margin: per year and per brand x year (brands ranked exactly like get_yearly_overview: top 15 by total, rest 'Other').
create or replace function public.get_yearly_margin(p_company text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '60s'
as $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := rnd_gate(p_company, p_as);
  if acc.user_id is null or not gm_can_see_cost(acc, p_as) then return null; end if;
  with u as (select * from gm_unit_cost(p_company)),
  b as (
    select f.year::int as year, f.cash_sold - f.cash_returned as net, f.qty_sold - f.qty_returned as nq, u.unit_cost,
           case when left(f.item_sku, 1) = '*' or upper(split_part(f.item_sku, '-', 1)) ~ '^[0-9]+$' then '(no brand)'
                else coalesce(sp.supplier_name, nullif(upper(split_part(f.item_sku, '-', 1)), ''), '(no brand)') end as brand
    from purchase_facts f
    left join supplier_prefix sp on sp.prefix = upper(split_part(f.item_sku, '-', 1))
    left join u on u.item_sku = f.item_sku and u.year = f.year
    where f.company = p_company and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
  ),
  yr as (
    select year, sum(nq * unit_cost) as cost, sum(net) filter (where unit_cost is not null) as covered from b group by year
  ),
  rk as (select brand, row_number() over (order by sum(net) desc nulls last) as rn from b group by brand),
  bb as (
    select b.year, case when r.rn <= 15 then b.brand else 'Other' end as brand,
           sum(b.nq * b.unit_cost) as cost, sum(b.net) filter (where b.unit_cost is not null) as covered
    from b join rk r on r.brand = b.brand group by 1, 2
  )
  select jsonb_build_object(
    'years', coalesce((select jsonb_agg(jsonb_build_object('year', year, 'cost', cost, 'covered', covered) order by year) from yr), '[]'::jsonb),
    'brands', coalesce((select jsonb_agg(jsonb_build_object('year', year, 'brand', brand, 'cost', cost, 'covered', covered)) from bb), '[]'::jsonb)
  ) into res;
  return res;
end;
$function$;
revoke all on function public.get_yearly_margin(text, uuid) from public, anon;
grant execute on function public.get_yearly_margin(text, uuid) to authenticated;

-- Year detail margin: per month and per brand x month (brands ranked like get_yearly_detail) for one year.
create or replace function public.get_yearly_detail_margin(p_company text, p_year int, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '60s'
as $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := rnd_gate(p_company, p_as);
  if acc.user_id is null or p_year is null or not gm_can_see_cost(acc, p_as) then return null; end if;
  if p_year = any(coalesce(acc.hidden_years, '{}'::int[])) then return null; end if;
  with u as (select * from gm_unit_cost(p_company) g where g.year = p_year),
  b as (
    select f.month::int as month, f.cash_sold - f.cash_returned as net, f.qty_sold - f.qty_returned as nq, u.unit_cost,
           case when left(f.item_sku, 1) = '*' or upper(split_part(f.item_sku, '-', 1)) ~ '^[0-9]+$' then '(no brand)'
                else coalesce(sp.supplier_name, nullif(upper(split_part(f.item_sku, '-', 1)), ''), '(no brand)') end as brand
    from purchase_facts f
    left join supplier_prefix sp on sp.prefix = upper(split_part(f.item_sku, '-', 1))
    left join u on u.item_sku = f.item_sku
    where f.company = p_company and f.year = p_year
  ),
  mo as (select month, sum(nq * unit_cost) as cost, sum(net) filter (where unit_cost is not null) as covered from b group by month),
  rk as (select brand, row_number() over (order by sum(net) desc nulls last) as rn from b group by brand),
  bb as (
    select b.month, case when r.rn <= 15 then b.brand else 'Other' end as brand,
           sum(b.nq * b.unit_cost) as cost, sum(b.net) filter (where b.unit_cost is not null) as covered
    from b join rk r on r.brand = b.brand group by 1, 2
  )
  select jsonb_build_object(
    'year', p_year,
    'months', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'cost', cost, 'covered', covered) order by month) from mo), '[]'::jsonb),
    'brands', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'brand', brand, 'cost', cost, 'covered', covered)) from bb), '[]'::jsonb)
  ) into res;
  return res;
end;
$function$;
revoke all on function public.get_yearly_detail_margin(text, int, uuid) from public, anon;
grant execute on function public.get_yearly_detail_margin(text, int, uuid) to authenticated;

-- Monthly data margin: net sales, cost and covered net per (year, month), all visible years.
create or replace function public.get_monthly_margin(p_company text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '60s'
as $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := rnd_gate(p_company, p_as);
  if acc.user_id is null or not gm_can_see_cost(acc, p_as) then return null; end if;
  with u as (select * from gm_unit_cost(p_company)),
  b as (
    select f.year::int as year, f.month::int as month, f.cash_sold - f.cash_returned as net,
           f.qty_sold - f.qty_returned as nq, u.unit_cost
    from purchase_facts f left join u on u.item_sku = f.item_sku and u.year = f.year
    where f.company = p_company and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
  )
  select jsonb_build_object('months', coalesce(jsonb_agg(jsonb_build_object('year', year, 'month', month, 'net', net,
           'cost', cost, 'covered', covered) order by year, month), '[]'::jsonb))
    into res
  from (select year, month, sum(net) as net, sum(nq * unit_cost) as cost, sum(net) filter (where unit_cost is not null) as covered
        from b group by year, month) t;
  return res;
end;
$function$;
revoke all on function public.get_monthly_margin(text, uuid) from public, anon;
grant execute on function public.get_monthly_margin(text, uuid) to authenticated;

-- Client card margin (also chain cards): same members / scope / lists as get_client_card.
create or replace function public.get_client_card_margin(p_company text, p_client_id text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare members text[]; acc dashboard_user_access; cur int; lim boolean; owner text; res jsonb;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null or not gm_can_see_cost(acc, p_as) then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  if p_client_id like 'chain:%' then
    select coalesce(array_agg(cc.client_id), '{}') into members
    from client_chains cc
    where cc.company = p_company and cc.chain_id = substr(p_client_id, 7)
      and (not lim or cc.client_id in (select o.client_id from client_owner_v(p_company) o where o.agent_id = any(acc.agents)));
    if coalesce(array_length(members, 1), 0) = 0 then return null; end if;
  else
    owner := client_owner_of(p_company, p_client_id);
    if lim and (owner is null or not (owner = any(acc.agents))) then return null; end if;
    members := array[p_client_id];
  end if;
  cur := extract(year from (now() at time zone 'Asia/Jerusalem'))::int * 12 + extract(month from (now() at time zone 'Asia/Jerusalem'))::int;

  with u as (select * from gm_unit_cost(p_company)),
  f as (
    select f.item_sku, f.year::int as year, f.month::int as month, f.year * 12 + f.month as ym, f.qty_sold,
           f.cash_sold - f.cash_returned as net, f.qty_sold - f.qty_returned as nq, u.unit_cost,
           case when left(f.item_sku, 1) = '*' or upper(split_part(f.item_sku, '-', 1)) ~ '^[0-9]+$' then 'Other'
                else coalesce(sp.supplier_name, nullif(upper(split_part(f.item_sku, '-', 1)), ''), '(no brand)') end as brand
    from purchase_facts f
    left join supplier_prefix sp on sp.prefix = upper(split_part(f.item_sku, '-', 1))
    left join u on u.item_sku = f.item_sku and u.year = f.year
    where f.company = p_company and f.client_id = any(members)
      and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
  ),
  months as (
    select year, month, sum(nq * unit_cost) as cost, sum(net) filter (where unit_cost is not null) as covered
    from f where ym > cur - 24 group by year, month
  ),
  years as (
    select year, sum(nq * unit_cost) as cost, sum(net) filter (where unit_cost is not null) as covered from f group by year
  ),
  top_items as (
    select item_sku, sum(net) as cash, sum(nq * unit_cost) as cost, sum(net) filter (where unit_cost is not null) as covered
    from f where ym > cur - 12 group by item_sku order by cash desc nulls last limit 15
  ),
  top_brands as (
    select brand, sum(net) as cash, sum(nq * unit_cost) as cost, sum(net) filter (where unit_cost is not null) as covered
    from f where ym > cur - 12 group by brand order by cash desc nulls last limit 8
  ),
  stopped as (
    select item_sku, sum(net) filter (where ym <= cur - 3) as cash,
           sum(nq * unit_cost) filter (where ym <= cur - 3) as cost,
           sum(net) filter (where ym <= cur - 3 and unit_cost is not null) as covered
    from f
    group by item_sku
    having count(distinct ym) filter (where ym between cur - 14 and cur - 3) >= 3
       and not exists (select 1 from f n2 where n2.item_sku = f.item_sku and n2.ym > cur - 3 and n2.qty_sold > 0)
    order by sum(net) filter (where ym <= cur - 3) desc nulls last
    limit 15
  )
  select jsonb_build_object(
    'cost12', (select sum(nq * unit_cost) from f where ym > cur - 12),
    'covered12', (select sum(net) filter (where unit_cost is not null) from f where ym > cur - 12),
    'months', (select coalesce(jsonb_agg(jsonb_build_object('y', year, 'm', month, 'cost', cost, 'covered', covered) order by year, month), '[]'::jsonb) from months),
    'years', (select coalesce(jsonb_agg(jsonb_build_object('y', year, 'cost', cost, 'covered', covered) order by year), '[]'::jsonb) from years),
    'topItems', (select coalesce(jsonb_agg(jsonb_build_object('sku', item_sku, 'cost', cost, 'covered', covered)), '[]'::jsonb) from top_items),
    'topBrands', (select coalesce(jsonb_agg(jsonb_build_object('brand', brand, 'cost', cost, 'covered', covered)), '[]'::jsonb) from top_brands),
    'stopped', (select coalesce(jsonb_agg(jsonb_build_object('sku', item_sku, 'cost', cost, 'covered', covered)), '[]'::jsonb) from stopped)
  ) into res;
  return res;
end;
$function$;
revoke all on function public.get_client_card_margin(text, text, uuid) from public, anon;
grant execute on function public.get_client_card_margin(text, text, uuid) to authenticated;

-- Item card margin: same scope as get_item_card; also the unit cost used per year and where it came from.
create or replace function public.get_item_card_margin(p_company text, p_sku text, p_as uuid default null)
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
  if acc.user_id is null or not gm_can_see_cost(acc, p_as) then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  if lim then
    select coalesce(array_agg(o.client_id), '{}') into mine from client_owner_v(p_company) o where o.agent_id = any(acc.agents);
  end if;
  cur := extract(year from (now() at time zone 'Asia/Jerusalem'))::int * 12 + extract(month from (now() at time zone 'Asia/Jerusalem'))::int;

  with u as (select * from gm_unit_cost(p_company) g where g.item_sku = p_sku),
  f as (
    select f.client_id, f.year::int as year, f.month::int as month, f.year * 12 + f.month as ym, f.qty_sold,
           f.cash_sold - f.cash_returned as net, f.qty_sold - f.qty_returned as nq, u.unit_cost
    from purchase_facts f left join u on u.year = f.year
    where f.company = p_company and f.item_sku = p_sku
      and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (not lim or f.client_id = any(mine))
  ),
  months as (
    select year, month, sum(nq * unit_cost) as cost, sum(net) filter (where unit_cost is not null) as covered
    from f where ym > cur - 24 group by year, month
  ),
  top_clients as (
    select client_id, sum(net) as cash, sum(nq * unit_cost) as cost, sum(net) filter (where unit_cost is not null) as covered
    from f where ym > cur - 12 group by client_id order by cash desc nulls last limit 15
  ),
  stopped as (
    select client_id, sum(net) filter (where ym <= cur - 3) as cash,
           sum(nq * unit_cost) filter (where ym <= cur - 3) as cost,
           sum(net) filter (where ym <= cur - 3 and unit_cost is not null) as covered
    from f
    group by client_id
    having count(distinct ym) filter (where ym between cur - 14 and cur - 3) >= 3
       and not exists (select 1 from f n2 where n2.client_id = f.client_id and n2.ym > cur - 3 and n2.qty_sold > 0)
    order by sum(net) filter (where ym <= cur - 3) desc nulls last
    limit 15
  )
  select jsonb_build_object(
    'cost12', (select sum(nq * unit_cost) from f where ym > cur - 12),
    'covered12', (select sum(net) filter (where unit_cost is not null) from f where ym > cur - 12),
    'unitCosts', (select coalesce(jsonb_agg(jsonb_build_object('year', year, 'unitCost', round(unit_cost, 4), 'basis', basis) order by year), '[]'::jsonb) from u),
    'months', (select coalesce(jsonb_agg(jsonb_build_object('y', year, 'm', month, 'cost', cost, 'covered', covered) order by year, month), '[]'::jsonb) from months),
    'topClients', (select coalesce(jsonb_agg(jsonb_build_object('id', client_id, 'cost', cost, 'covered', covered)), '[]'::jsonb) from top_clients),
    'stopped', (select coalesce(jsonb_agg(jsonb_build_object('id', client_id, 'cost', cost, 'covered', covered)), '[]'::jsonb) from stopped)
  ) into res;
  return res;
end;
$function$;
revoke all on function public.get_item_card_margin(text, text, uuid) from public, anon;
grant execute on function public.get_item_card_margin(text, text, uuid) to authenticated;

-- Search sales: each line gets unitCost (the item's unit cost for the line's year) when the caller may see costs, else null.
-- The client computes line margin = cash - qty x unitCost. 'margin' tells whether the caller may see cost at all.
create or replace function public.get_client_item_sales(
  p_company text,
  p_client_id text,
  p_query text,
  p_from date default null,
  p_to date default null,
  p_as uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access; lim boolean; owner text; members text[]; tokens text[];
  q text; total bigint; res jsonb; can_cost boolean;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null or p_client_id is null then return null; end if;
  can_cost := gm_can_see_cost(acc, p_as);
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  if p_client_id like 'chain:%' then
    select coalesce(array_agg(cc.client_id), '{}') into members
    from client_chains cc
    where cc.company = p_company and cc.chain_id = substr(p_client_id, 7)
      and (not lim or cc.client_id in (select o.client_id from client_owner_v(p_company) o where o.agent_id = any(acc.agents)));
    if coalesce(array_length(members, 1), 0) = 0 then return null; end if;
  else
    owner := client_owner_of(p_company, p_client_id);
    if lim and (owner is null or not (owner = any(acc.agents))) then return null; end if;
    members := array[p_client_id];
  end if;

  q := lower(btrim(coalesce(p_query, '')));
  if q = '' then return jsonb_build_object('total', 0, 'rows', '[]'::jsonb, 'margin', can_cost); end if;
  tokens := regexp_split_to_array(q, '\s+');

  select count(*) into total
  from sales_lines s
  where s.company = p_company and s.client_id = any(members)
    and s.line_source like 'rep891%' and s.item_sku is not null
    and s.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
    and (p_from is null or s.line_date >= p_from) and (p_to is null or s.line_date <= p_to)
    and not exists (select 1 from unnest(tokens) t
                    where strpos(lower(s.item_sku || ' ' || coalesce(s.item_name, '')), t) = 0);

  with uc as materialized (select g.item_sku, g.year, g.unit_cost from gm_unit_cost(p_company) g where can_cost)
  select jsonb_build_object('total', total, 'margin', can_cost, 'rows', coalesce(jsonb_agg(jsonb_build_object(
           'date', to_char(r.line_date, 'YYYY-MM-DD'), 'docNum', coalesce(r.doc_num, ''), 'docType', coalesce(r.doc_type, ''),
           'clientID', r.client_id, 'sku', r.item_sku, 'name', coalesce(r.item_name, ''),
           'qty', r.qty, 'cash', r.cash,
           'price', case when coalesce(r.qty, 0) <> 0 then round(r.cash / r.qty, 4) end,
           'discountPct', r.discount_pct, 'discountCash', r.discount_cash,
           'isReturn', r.is_return,
           'unitCost', case when can_cost then r.unit_cost end)
         order by r.line_date desc, r.id desc), '[]'::jsonb))
    into res
  from (
    select s.id, s.line_date, s.doc_num, s.doc_type, s.client_id, s.item_sku, s.item_name, s.qty, s.cash,
           s.discount_pct, s.discount_cash,
           (s.doc_type = '14' and s.cash < 0 and not exists (
              select 1 from sales_lines r2
              join return_reason_rules u on u.company = r2.company and u.code = r2.return_reason_code and not u.counts_as_return
              where r2.company = p_company and r2.line_source = '855'
                and r2.client_id = s.client_id and r2.item_sku = s.item_sku and r2.line_date = s.line_date
                and round(abs(r2.qty), 2) = round(abs(s.qty), 2))) as is_return,
           uc.unit_cost
    from sales_lines s
    left join uc on uc.item_sku = s.item_sku and uc.year = s.year
    where s.company = p_company and s.client_id = any(members)
      and s.line_source like 'rep891%' and s.item_sku is not null
      and s.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (p_from is null or s.line_date >= p_from) and (p_to is null or s.line_date <= p_to)
      and not exists (select 1 from unnest(tokens) t
                      where strpos(lower(s.item_sku || ' ' || coalesce(s.item_name, '')), t) = 0)
    order by s.line_date desc, s.id desc
    limit 5000
  ) r;
  return res;
end;
$function$;
revoke all on function public.get_client_item_sales(text, text, text, date, date, uuid) from public, anon;
grant execute on function public.get_client_item_sales(text, text, text, date, date, uuid) to authenticated;
