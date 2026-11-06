-- Item category history: remember the LAST non-empty category (REP103 column I = item_catalog.tablet_cat) every item
-- ever had, with the date it was seen. Purpose: when an item comes back in stock (or is in stock without a category)
-- the report can offer its previous category.
--
-- Maintained by a trigger on item_catalog, so every REP103 load (06:00 and the midday run, insert or upsert) feeds it
-- with no change to the sync code.
--   * only a non-empty (trimmed) tablet_cat touches the table; an empty value NEVER overwrites or erases last_category
--   * same value again   -> only category_seen_at is refreshed (never moves backwards)
--   * different value    -> last_category replaced, old one kept in previous_category, changed_at / first_seen reset
-- category_seen_at = the load's synced_at stamp. Rows of items that left the export are not re-stamped, so their
-- category_seen_at keeps the date of their last appearance.
-- History before this migration does not exist anywhere (item_catalog keeps one row per item, source_file_observations
-- holds file metadata only); the backfill takes the current item_catalog state, so history starts at the backfill.
-- The table is service-role only (RLS on, no policies, no grants); users reach it via the definer functions below.

create table if not exists public.item_category_last (
  company                       text        not null,
  sku                           text        not null,
  last_category                 text        not null check (btrim(last_category) <> ''),
  category_seen_at              timestamptz not null,   -- last load in which the item was seen with last_category
  first_seen_with_this_category timestamptz not null,   -- first load we saw it with last_category (history starts at backfill)
  previous_category             text,
  changed_at                    timestamptz,            -- when last_category replaced previous_category
  primary key (company, sku)
);
alter table public.item_category_last enable row level security;
revoke all on public.item_category_last from public, anon, authenticated;

create or replace function public.trg_item_category_last()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_cat text := btrim(new.tablet_cat);
  v_at  timestamptz := coalesce(new.synced_at, now());
begin
  if v_cat is null or v_cat = '' then
    return new;   -- empty / removed category: never touches the stored last category
  end if;
  insert into item_category_last as t
         (company, sku, last_category, category_seen_at, first_seen_with_this_category)
  values (new.company, new.sku, v_cat, v_at, v_at)
  on conflict (company, sku) do update set
    previous_category = case when t.last_category <> excluded.last_category then t.last_category else t.previous_category end,
    changed_at        = case when t.last_category <> excluded.last_category then excluded.category_seen_at else t.changed_at end,
    first_seen_with_this_category =
                        case when t.last_category <> excluded.last_category then excluded.category_seen_at
                             else t.first_seen_with_this_category end,
    category_seen_at  = case when t.last_category <> excluded.last_category then excluded.category_seen_at
                             else greatest(t.category_seen_at, excluded.category_seen_at) end,
    last_category     = excluded.last_category;
  return new;
end;
$function$;
revoke all on function public.trg_item_category_last() from public, anon, authenticated;

drop trigger if exists item_catalog_category_last on public.item_catalog;
create trigger item_catalog_category_last
  after insert or update of tablet_cat, synced_at on public.item_catalog
  for each row
  when (nullif(btrim(new.tablet_cat), '') is not null)
  execute function public.trg_item_category_last();

-- Backfill from the current item_catalog (stale rows keep their old synced_at = last time seen).
insert into public.item_category_last (company, sku, last_category, category_seen_at, first_seen_with_this_category)
select company, sku, btrim(tablet_cat), synced_at, synced_at
from public.item_catalog
where nullif(btrim(tablet_cat), '') is not null
on conflict (company, sku) do nothing;

-- Items index: + lcat (last known category) and lcatAt (date seen), null when none. Same gates as before.
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
           'wms',  s.qty,
           'lcat',   h.last_category,
           'lcatAt', h.category_seen_at
         ) order by c.company, c.sku), '[]'::jsonb)
    into res
  from item_catalog c
  join latest l on l.company = c.company and c.synced_at >= l.m - interval '2 hours'
  left join item_pricing       p on p.company = c.company and p.sku = c.sku
  left join item_pricing_admin a on a.company = c.company and a.sku = c.sku
  left join stock              s on s.company = c.company and s.sku = c.sku
  left join item_category_last h on h.company = c.company and h.sku = c.sku
  where c.company = any(acc.companies)
    and nullif(btrim(c.tablet_cat), '') is not null;

  return jsonb_build_object('rows', res, 'showCost', show_cost, 'showFob', show_fob);
end;
$function$;
revoke all on function public.get_item_index() from public, anon;
grant execute on function public.get_item_index() to authenticated;

-- In-stock items without a category, each with its last known category and date (lcat / lcatAt, null if never seen).
-- p_company null = every company the user may see. Same gate and definition as get_uncategorized_stock.
create or replace function public.get_item_category_restore(p_company text default null)
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
      and (p_company is null or company = p_company)
      and btrim(sku) <> 'סך הכל'  -- the stock file's grand-total line is not an item
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
           'why',  case when c.sku is null then 'no_row' else 'empty' end,
           'lcat',   h.last_category,
           'lcatAt', h.category_seen_at
         ) order by s.company, s.qty desc, s.sku), '[]'::jsonb)
    into res
  from stock s
  left join cat c on c.company = s.company and c.sku = s.sku
  left join item_pricing p on p.company = s.company and p.sku = s.sku
  left join item_category_last h on h.company = s.company and h.sku = s.sku
  where nullif(btrim(c.tablet_cat), '') is null;

  return jsonb_build_object('rows', res);
end;
$function$;
revoke all on function public.get_item_category_restore(text) from public, anon;
grant execute on function public.get_item_category_restore(text) to authenticated;

-- The existing no-category report RPC now simply returns the restore data (superset of its old payload).
create or replace function public.get_uncategorized_stock()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
  select public.get_item_category_restore(null);
$function$;
revoke all on function public.get_uncategorized_stock() from public, anon;
grant execute on function public.get_uncategorized_stock() to authenticated;
