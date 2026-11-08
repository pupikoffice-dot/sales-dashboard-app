-- Loader support for item104<co>.xls (category NUMBERS, same items as item103).
-- 1) item_catalog.tablet_cat_code: the category-7 (column I) NUMBER next to the description in tablet_cat.
alter table public.item_catalog add column if not exists tablet_cat_code text;

-- 2) Sync-only update of that column: existing rows only, and only where the value changes (so an hourly run writes nothing
--    when the export did not change). Never inserts, never touches tablet_cat / synced_at (no category-history trigger).
create or replace function public.set_item_catalog_codes(p_company text, p_rows jsonb)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare n integer;
begin
  update item_catalog ic
     set tablet_cat_code = nullif(btrim(r.code), '')
    from jsonb_to_recordset(p_rows) as r(sku text, code text)
   where ic.company = p_company
     and ic.sku = r.sku
     and ic.tablet_cat_code is distinct from nullif(btrim(r.code), '');
  get diagnostics n = row_count;
  return n;
end;
$function$;
revoke all on function public.set_item_catalog_codes(text, jsonb) from public, anon, authenticated;
grant execute on function public.set_item_catalog_codes(text, jsonb) to service_role;

-- 3) Monitor rules: the sync loads these files, so they need a freshness rule (otherwise the coverage guard goes red).
--    Weekly (168 h) until the owner confirms rep104 is part of the daily items task.
insert into public.source_files (file_name, company, file_group, producer, fix_hint, impact, rule_kind, max_age_hours, rows_check, active) values
('item104pupik.xls','pupik','items_daily','smartpupik item master with category numbers (ERP report 104)','smartpupik Task app: run the item 104 export (next to Daily items 103)','Category number to description lookup, item category numbers','age',168,true,true),
('item104mt.xls','mt','items_daily','smartpupik item master with category numbers (ERP report 104)','smartpupik Task app: run the item 104 export (next to Daily items 103)','Category number to description lookup, item category numbers','age',168,true,true)
on conflict (file_name) do update set file_group = excluded.file_group, producer = excluded.producer,
  fix_hint = excluded.fix_hint, impact = excluded.impact, max_age_hours = excluded.max_age_hours,
  rows_check = excluded.rows_check, active = excluded.active;
