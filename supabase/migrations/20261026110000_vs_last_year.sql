-- Client card and item card: this year against last year, so changes show.
-- Period = January up to the last FULL month of this year, against the same months of last year (in January: January
-- against January). Net cash = cash_sold - cash_returned (revenue after returns), pieces net of returns.
-- Same access as the cards: purchase_cards_gate (View-as, hidden years) and, for an agent-limited user, only his clients
-- (a client card of another agent's client returns nothing; the item view counts only his clients).

create or replace function public.get_client_vs_last_year(p_company text, p_client_id text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; lim boolean; owner text; yr int; mo int; thru int; res jsonb;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  owner := client_owner_of(p_company, p_client_id);
  if lim and (owner is null or not (owner = any(acc.agents))) then return null; end if;
  yr := extract(year from (now() at time zone 'Asia/Jerusalem'))::int;
  mo := extract(month from (now() at time zone 'Asia/Jerusalem'))::int;
  thru := greatest(mo - 1, 1);

  with f as (
    select f.*, case when f.year = yr then 'cy' when f.year = yr - 1 then 'ly' end as per
    from purchase_facts f
    where f.company = p_company and f.client_id = p_client_id
      and f.year in (yr, yr - 1) and f.month <= thru
      and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
  ),
  named as (
    select f.*, coalesce(nullif(p.name, ''), f.item_sku) as item_name,
           case when left(f.item_sku, 1) = '*' or upper(split_part(f.item_sku, '-', 1)) ~ '^[0-9]+$' then '(no brand)'
                else coalesce(sp.supplier_name, nullif(upper(split_part(f.item_sku, '-', 1)), ''), '(no brand)') end as brand
    from f
    left join item_pricing p on p.company = f.company and p.sku = f.item_sku
    left join supplier_prefix sp on sp.prefix = upper(split_part(f.item_sku, '-', 1))
  ),
  items as (
    select item_sku as sku, max(item_name) as name,
           coalesce(sum(cash_sold - cash_returned) filter (where per = 'cy'), 0) as cy_cash,
           coalesce(sum(cash_sold - cash_returned) filter (where per = 'ly'), 0) as ly_cash,
           coalesce(sum(qty_sold - qty_returned) filter (where per = 'cy'), 0) as cy_qty,
           coalesce(sum(qty_sold - qty_returned) filter (where per = 'ly'), 0) as ly_qty
    from named group by item_sku
    order by greatest(abs(coalesce(sum(cash_sold - cash_returned) filter (where per = 'cy'), 0)),
                      abs(coalesce(sum(cash_sold - cash_returned) filter (where per = 'ly'), 0))) desc
    limit 20
  ),
  brands as (
    select brand,
           coalesce(sum(cash_sold - cash_returned) filter (where per = 'cy'), 0) as cy_cash,
           coalesce(sum(cash_sold - cash_returned) filter (where per = 'ly'), 0) as ly_cash
    from named group by brand
    order by greatest(abs(coalesce(sum(cash_sold - cash_returned) filter (where per = 'cy'), 0)),
                      abs(coalesce(sum(cash_sold - cash_returned) filter (where per = 'ly'), 0))) desc
    limit 10
  )
  select jsonb_build_object(
    'year', yr, 'prevYear', yr - 1, 'throughMonth', thru,
    'cy', (select jsonb_build_object('sold', coalesce(sum(cash_sold), 0), 'returned', coalesce(sum(cash_returned), 0),
              'qty', coalesce(sum(qty_sold - qty_returned), 0), 'docs', coalesce(sum(docs_sold), 0)) from f where per = 'cy'),
    'ly', (select jsonb_build_object('sold', coalesce(sum(cash_sold), 0), 'returned', coalesce(sum(cash_returned), 0),
              'qty', coalesce(sum(qty_sold - qty_returned), 0), 'docs', coalesce(sum(docs_sold), 0)) from f where per = 'ly'),
    'items', coalesce((select jsonb_agg(jsonb_build_object('sku', sku, 'name', name, 'cy', cy_cash, 'ly', ly_cash,
                'cyQty', cy_qty, 'lyQty', ly_qty)) from items), '[]'::jsonb),
    'brands', coalesce((select jsonb_agg(jsonb_build_object('brand', brand, 'cy', cy_cash, 'ly', ly_cash)) from brands), '[]'::jsonb)
  ) into res;
  return res;
end;
$function$;
grant execute on function public.get_client_vs_last_year(text, text, uuid) to authenticated;

create or replace function public.get_item_vs_last_year(p_company text, p_sku text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; lim boolean; mine text[]; yr int; mo int; thru int; res jsonb;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  if lim then
    select coalesce(array_agg(o.client_id), '{}') into mine from client_owner_v(p_company) o where o.agent_id = any(acc.agents);
  end if;
  yr := extract(year from (now() at time zone 'Asia/Jerusalem'))::int;
  mo := extract(month from (now() at time zone 'Asia/Jerusalem'))::int;
  thru := greatest(mo - 1, 1);

  with f as (
    select f.*, case when f.year = yr then 'cy' when f.year = yr - 1 then 'ly' end as per
    from purchase_facts f
    where f.company = p_company and f.item_sku = p_sku
      and f.year in (yr, yr - 1) and f.month <= thru
      and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (not lim or f.client_id = any(mine))
  ),
  clients_cmp as (
    select f.client_id as id, max(coalesce(nullif(c.name, ''), f.client_id)) as name,
           coalesce(sum(f.cash_sold - f.cash_returned) filter (where per = 'cy'), 0) as cy_cash,
           coalesce(sum(f.cash_sold - f.cash_returned) filter (where per = 'ly'), 0) as ly_cash,
           coalesce(sum(f.qty_sold - f.qty_returned) filter (where per = 'cy'), 0) as cy_qty,
           coalesce(sum(f.qty_sold - f.qty_returned) filter (where per = 'ly'), 0) as ly_qty
    from f left join clients c on c.company = f.company and c.erp_client_id = f.client_id
    group by f.client_id
    order by greatest(abs(coalesce(sum(f.qty_sold - f.qty_returned) filter (where per = 'cy'), 0)),
                      abs(coalesce(sum(f.qty_sold - f.qty_returned) filter (where per = 'ly'), 0))) desc
    limit 20
  )
  select jsonb_build_object(
    'scoped', lim, 'year', yr, 'prevYear', yr - 1, 'throughMonth', thru,
    'cy', (select jsonb_build_object('sold', coalesce(sum(cash_sold), 0), 'returned', coalesce(sum(cash_returned), 0),
              'qty', coalesce(sum(qty_sold - qty_returned), 0), 'qtySold', coalesce(sum(qty_sold), 0),
              'qtyReturned', coalesce(sum(qty_returned), 0),
              'clients', count(distinct client_id) filter (where qty_sold > 0)) from f where per = 'cy'),
    'ly', (select jsonb_build_object('sold', coalesce(sum(cash_sold), 0), 'returned', coalesce(sum(cash_returned), 0),
              'qty', coalesce(sum(qty_sold - qty_returned), 0), 'qtySold', coalesce(sum(qty_sold), 0),
              'qtyReturned', coalesce(sum(qty_returned), 0),
              'clients', count(distinct client_id) filter (where qty_sold > 0)) from f where per = 'ly'),
    'clients', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'cy', cy_cash, 'ly', ly_cash,
                'cyQty', cy_qty, 'lyQty', ly_qty)) from clients_cmp), '[]'::jsonb)
  ) into res;
  return res;
end;
$function$;
grant execute on function public.get_item_vs_last_year(text, text, uuid) to authenticated;
