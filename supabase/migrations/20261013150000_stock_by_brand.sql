-- Stock by brand: current WMS stock (inventory = 000pupik / 000mt) grouped by the same brand (supplier)
-- naming the Sales page uses: supplier_prefix name from the SKU prefix; "*" and numeric prefixes count as
-- the company's own name. Value at cost is returned only to users who may see item cost.
create or replace function public.get_stock_by_brand()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access;
  show_value boolean;
  res jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null then
    return jsonb_build_object('rows', '[]'::jsonb, 'showValue', false);
  end if;
  show_value := acc.show_item_cost or is_super_admin();

  with inv as (
    select i.company, i.sku, sum(i.qty_on_hand) as qty
    from inventory i
    where i.company = any(acc.companies)
      and btrim(i.sku) <> 'סך הכל'  -- the stock file's grand-total line is loaded as a row; it is not an item
    group by i.company, i.sku
  ),
  branded as (
    select v.company, v.sku, v.qty,
      case
        when left(coalesce(v.sku,''), 1) = '*'
             or upper(split_part(coalesce(v.sku,''),'-',1)) ~ '^[0-9]+$'
          then case v.company
                 when 'pupik' then 'Pupik'
                 when 'mt' then 'Monkeytime'
                 when 'grow' then 'Grow'
                 when 'gold' then 'Gold'
                 else initcap(v.company) end
        else coalesce(sp.supplier_name, nullif(upper(split_part(v.sku,'-',1)), ''), '(no brand)')
      end as brand,
      case when show_value then a.cost end as cost
    from inv v
    left join supplier_prefix sp on sp.prefix = upper(split_part(v.sku,'-',1))
    left join item_pricing_admin a on a.company = v.company and a.sku = v.sku
  )
  select jsonb_build_object(
    'showValue', show_value,
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'co', b.company, 'brand', b.brand, 'items', b.items, 'inStock', b.in_stock,
      'units', b.units, 'value', b.value, 'noCost', b.no_cost) order by b.company, b.units desc), '[]'::jsonb))
  into res
  from (
    select company, brand,
           count(*)                               as items,
           count(*) filter (where qty > 0)        as in_stock,
           sum(qty)                               as units,
           case when show_value then sum(qty * cost) filter (where cost is not null) end as value,
           case when show_value then count(*) filter (where qty > 0 and cost is null) end as no_cost
    from branded
    group by company, brand
  ) b;

  return res;
end;
$function$;

revoke all on function public.get_stock_by_brand() from public, anon;
grant execute on function public.get_stock_by_brand() to authenticated;
