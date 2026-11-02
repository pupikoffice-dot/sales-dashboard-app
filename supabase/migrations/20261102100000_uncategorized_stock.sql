-- Items in stock that have no category (REP103 column I = item_catalog.tablet_cat).
-- Uncategorised = WMS stock (inventory.qty_on_hand summed per sku) > 0 and the item has no non-empty tablet_cat in its
-- company's latest REP103 load (same "latest" rule as get_item_index: stamp within 2 h of the company's newest).
-- An item with no item_catalog row at all, an empty column I, or only an old row (left the export) all count.
-- Same gate as get_item_index: signed-in user with access, 'date.items' not hidden, own companies only.
create or replace function public.get_uncategorized_stock()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access;
  res jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null or 'date.items' = any(coalesce(acc.hidden_sidebar, '{}')) then
    return jsonb_build_object('rows', '[]'::jsonb);
  end if;

  with stock as (
    select company, sku, sum(qty_on_hand) as qty, max(name) as inv_name
    from inventory
    where company = any(acc.companies)
      and btrim(sku) <> 'סך הכל'  -- the stock file's grand-total line is loaded as a row; it is not an item
    group by company, sku
    having sum(qty_on_hand) > 0
  ),
  latest as (
    select company, max(synced_at) as m
    from item_catalog
    where company = any(acc.companies)
    group by company
  ),
  cat as (
    select c.company, c.sku, c.tablet_cat
    from item_catalog c
    join latest l on l.company = c.company and c.synced_at >= l.m - interval '2 hours'
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'co',   s.company,
           'sku',  s.sku,
           'name', coalesce(nullif(p.name, ''), s.inv_name, ''),
           'p01',  p.list_price,
           'wms',  s.qty,
           'why',  case when c.sku is null then 'no_row' else 'empty' end
         ) order by s.company, s.qty desc, s.sku), '[]'::jsonb)
    into res
  from stock s
  left join cat c on c.company = s.company and c.sku = s.sku
  left join item_pricing p on p.company = s.company and p.sku = s.sku
  where nullif(btrim(c.tablet_cat), '') is null;

  return jsonb_build_object('rows', res);
end;
$function$;

revoke all on function public.get_uncategorized_stock() from public, anon;
grant execute on function public.get_uncategorized_stock() to authenticated;
