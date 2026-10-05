-- Items index (sidebar FILTER -> Items): every item that has a value in REP103 column I
-- (item_catalog.tablet_cat), with its REP907 data and WMS stock, in one fast call.
--
-- Data:
--   item_catalog        REP103 / item103: sku, tablet_cat (column I)
--   item_pricing        REP907: name, list_price (P01), barcode, alt_sku (new)
--   item_pricing_admin  REP907: cost (landed cost), fob (new) - never readable by normal users
--   inventory           WMS 000<co>.xls: qty_on_hand
-- Per-user hides (dashboard_user_access.hidden_sidebar):
--   date.items      -> the Items tab is hidden and the RPC returns nothing
--   items.col.cost  -> landed cost column hidden (returned as null)
--   items.col.fob   -> FOB column hidden (returned as null)
-- Cost and FOB additionally need the existing show_item_cost permission (or super admin).

alter table public.item_pricing       add column if not exists alt_sku text;
alter table public.item_pricing_admin add column if not exists fob numeric;

-- Sync bookkeeping: REP907 / REP103 are reloaded only when the export file changed.
create table if not exists public.sync_file_state (
  file_name text primary key,
  signature text not null,          -- '<mtime>:<size>' of the loaded file
  loaded_at timestamptz not null default now()
);
alter table public.sync_file_state enable row level security;   -- service role only (no policies)

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
