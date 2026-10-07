-- Items index: only items that were in their company's latest REP103 export.
-- The sync stamps item_catalog.synced_at on every item it sees; rows of items that left the export keep their
-- old stamp (their categories still serve historical sales reports) and are no longer listed in the index.
-- "Latest" = within 2 hours of the company's newest stamp (one file load takes well under a minute).

create or replace function public.get_item_index()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access;
  can_cost boolean;
  show_cost boolean;
  show_fob boolean;
  res jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null or 'date.items' = any(coalesce(acc.hidden_sidebar, '{}')) then
    return jsonb_build_object('rows', '[]'::jsonb, 'showCost', false, 'showFob', false);
  end if;

  can_cost  := acc.show_item_cost or is_super_admin();
  show_cost := can_cost and not ('items.col.cost' = any(coalesce(acc.hidden_sidebar, '{}')));
  show_fob  := can_cost and not ('items.col.fob'  = any(coalesce(acc.hidden_sidebar, '{}')));

  with stock as (
    select company, sku, sum(qty_on_hand) as qty
    from inventory
    where company = any(acc.companies)
    group by company, sku
  ),
  latest as (
    select company, max(synced_at) as m
    from item_catalog
    where company = any(acc.companies)
    group by company
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'co',   c.company,
           'sku',  c.sku,
           'name', coalesce(p.name, ''),
           'alt',  p.alt_sku,
           'bc',   p.barcode,
           'cat',  c.tablet_cat,
           'p01',  p.list_price,
           'cost', case when show_cost then a.cost end,
           'fob',  case when show_fob  then a.fob  end,
           'wms',  s.qty
         ) order by c.company, c.sku), '[]'::jsonb)
    into res
  from item_catalog c
  join latest l on l.company = c.company and c.synced_at >= l.m - interval '2 hours'
  left join item_pricing       p on p.company = c.company and p.sku = c.sku
  left join item_pricing_admin a on a.company = c.company and a.sku = c.sku
  left join stock              s on s.company = c.company and s.sku = c.sku
  where c.company = any(acc.companies)
    and nullif(btrim(c.tablet_cat), '') is not null;

  return jsonb_build_object('rows', res, 'showCost', show_cost, 'showFob', show_fob);
end;
$function$;

revoke all on function public.get_item_index() from public, anon;
grant execute on function public.get_item_index() to authenticated;

-- REP907.BAT now runs pupik, mt and gold (grow is not needed): gold joins the daily rules, grow's old manual rule is off.
update public.source_files
   set file_group = 'items_daily', max_age_hours = 30, active = true,
       producer = 'smartpupik daily price list (ERP report 907)',
       fix_hint = 'smartpupik Task app: run Daily items 103 + 907',
       impact = 'Items index prices, cost, FOB, barcodes'
 where file_name = 'REP907gold.xls';
update public.source_files set active = false where file_name = 'REP907grow.xls';
