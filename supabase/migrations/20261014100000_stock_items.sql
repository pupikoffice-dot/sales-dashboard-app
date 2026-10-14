-- Stock by brand drill-down: every stocked item with its brand (same naming as get_stock_by_brand), quantity and
-- unit cost. Cost is returned only to users who may see item cost. The stock file's grand-total line is not an item.
create or replace function public.get_stock_items()
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

  select jsonb_build_object(
    'showValue', show_value,
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'co', v.company, 'brand', v.brand, 'sku', v.sku, 'name', v.name, 'qty', v.qty, 'cost', v.cost
    ) order by v.company, v.brand, v.sku), '[]'::jsonb))
  into res
  from (
    select i.company, i.sku, max(i.name) as name, sum(i.qty_on_hand) as qty,
      case
        when left(coalesce(i.sku,''), 1) = '*'
             or upper(split_part(coalesce(i.sku,''),'-',1)) ~ '^[0-9]+$'
          then case i.company
                 when 'pupik' then 'Pupik'
                 when 'mt' then 'Monkeytime'
                 when 'grow' then 'Grow'
                 when 'gold' then 'Gold'
                 else initcap(i.company) end
        else coalesce(sp.supplier_name, nullif(upper(split_part(i.sku,'-',1)), ''), '(no brand)')
      end as brand,
      case when show_value then max(a.cost) end as cost
    from inventory i
    left join supplier_prefix sp on sp.prefix = upper(split_part(i.sku,'-',1))
    left join item_pricing_admin a on a.company = i.company and a.sku = i.sku
    where i.company = any(acc.companies)
      and btrim(i.sku) <> 'סך הכל'
    group by i.company, i.sku, sp.supplier_name
  ) v;

  return res;
end;
$function$;

revoke all on function public.get_stock_items() from public, anon;
grant execute on function public.get_stock_items() to authenticated;
