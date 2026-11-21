-- Margin exceptions report (Admin > Data health button): per company, the items of one year that have NO cost and the items
-- whose gross margin is under 10%. Same cost basis as the dashboard gross margin (gm_unit_cost: import cost of the year, else
-- current cost; no row = no cost). Margin = net sales - net qty x unit cost, over net sales (returns deducted).
-- Visibility: same rule as the other margin functions - only a super admin or a user with show_item_cost, not agent-limited,
-- and only for the companies of that user. Anyone else gets null. Grow is not listed (its sales sit inside Pupik).
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
    nm as (
      select distinct on (s.item_sku) s.item_sku, s.item_name
      from sales_lines s
      where s.company = co and s.year = y and s.item_name is not null and s.item_sku in (select sku from flagged)
      order by s.item_sku, s.line_date desc
    )
    select jsonb_build_object(
      'company', co,
      'noCost', coalesce(jsonb_agg(jsonb_build_object('sku', f.sku, 'name', nm.item_name, 'qty', f.qty, 'net', f.net)
                  order by f.net desc nulls last) filter (where f.unit_cost is null), '[]'::jsonb),
      'lowMargin', coalesce(jsonb_agg(jsonb_build_object('sku', f.sku, 'name', nm.item_name, 'qty', f.qty, 'net', f.net,
                  'unitCost', f.unit_cost) order by f.net desc nulls last) filter (where f.unit_cost is not null), '[]'::jsonb))
      into one
    from flagged f left join nm on nm.item_sku = f.sku;
    res := res || jsonb_build_array(one);
  end loop;

  return jsonb_build_object('year', y, 'asOf', (now() at time zone 'Asia/Jerusalem')::date, 'companies', res);
end;
$function$;
revoke all on function public.get_margin_exceptions(int) from public, anon;
grant execute on function public.get_margin_exceptions(int) to authenticated;
