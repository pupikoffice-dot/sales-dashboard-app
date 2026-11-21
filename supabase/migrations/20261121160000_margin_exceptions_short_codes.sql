-- Margin exceptions report: keep cut item codes out of the lists.
-- Until every ERP export carries the full item code, some sales lines still hold a code cut to 11 characters (for example
-- RZR-1307342 instead of RZR-13073427). Such a code has no cost on file, so it would show up as "no cost" although the real item
-- has one. A no-cost item whose code is exactly 11 characters and is the start of a longer code known for the same company
-- (item catalog, prices or sales) is therefore NOT listed under noCost; it is returned under shortCodes so it can be seen and fixed
-- by re-exporting. Items that have their own cost are never moved, whatever their length.
create or replace function public.get_margin_exceptions(p_year int default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '120s'
as $function$
declare acc dashboard_user_access; y int; co text; one jsonb; res jsonb := '[]'::jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null or not (is_super_admin() or coalesce(acc.show_item_cost, false)) then return null; end if;
  if acc.agents is not null and array_length(acc.agents, 1) is not null then return null; end if;
  y := coalesce(p_year, extract(year from (now() at time zone 'Asia/Jerusalem'))::int);
  if y = any(coalesce(acc.hidden_years, '{}'::int[])) then return null; end if;

  foreach co in array array['pupik', 'mt', 'gold'] loop
    continue when not (co = any(acc.companies));
    with u as (select g.item_sku, g.unit_cost from gm_unit_cost(co) g where g.year = y),
    b as (
      select f.item_sku as sku, sum(f.qty_sold - f.qty_returned) as qty, sum(f.cash_sold - f.cash_returned) as net
      from purchase_facts f where f.company = co and f.year = y group by 1
    ),
    j as (select b.sku, b.qty, b.net, u.unit_cost from b left join u on u.item_sku = b.sku),
    flagged as (select * from j where unit_cost is null or (net > 0 and (net - qty * unit_cost) / net < 0.10)),
    longp as (
      select distinct left(k.sku, 11) as p
      from (select c.sku from item_catalog c where c.company = co
            union select p2.sku from item_pricing p2 where p2.company = co
            union select f2.item_sku from purchase_facts f2 where f2.company = co) k
      where length(k.sku) > 11
    ),
    marked as (
      select fl.*, (fl.unit_cost is null and length(fl.sku) = 11 and fl.sku in (select p from longp)) as is_short from flagged fl
    ),
    nm as (
      select distinct on (s.item_sku) s.item_sku, s.item_name
      from sales_lines s
      where s.company = co and s.year = y and s.item_name is not null and s.item_sku in (select sku from flagged)
      order by s.item_sku, s.line_date desc
    )
    select jsonb_build_object(
      'company', co,
      'noCost', coalesce(jsonb_agg(jsonb_build_object('sku', f.sku, 'name', nm.item_name, 'qty', f.qty, 'net', f.net)
                  order by f.net desc nulls last) filter (where f.unit_cost is null and not f.is_short), '[]'::jsonb),
      'lowMargin', coalesce(jsonb_agg(jsonb_build_object('sku', f.sku, 'name', nm.item_name, 'qty', f.qty, 'net', f.net,
                  'unitCost', f.unit_cost) order by f.net desc nulls last) filter (where f.unit_cost is not null), '[]'::jsonb),
      'shortCodes', coalesce(jsonb_agg(jsonb_build_object('sku', f.sku, 'name', nm.item_name, 'qty', f.qty, 'net', f.net)
                  order by f.net desc nulls last) filter (where f.is_short), '[]'::jsonb))
      into one
    from marked f left join nm on nm.item_sku = f.sku;
    res := res || jsonb_build_array(one);
  end loop;

  return jsonb_build_object('year', y, 'asOf', (now() at time zone 'Asia/Jerusalem')::date, 'companies', res);
end;
$function$;
revoke all on function public.get_margin_exceptions(int) from public, anon;
grant execute on function public.get_margin_exceptions(int) to authenticated;
