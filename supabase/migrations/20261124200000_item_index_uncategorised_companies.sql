-- Items index for a company that does not use categories (Goldbug): list its items from the price list (REP907)
-- instead of from the item103 category export. Pupik / Monkeytime are unchanged: a company with at least one
-- categorised item in item_catalog keeps the old rule (latest export, category required).
--
-- Done by rewriting the live function definition (it was patched after its migration by the page-permission
-- migration, so re-creating it from the older file would silently drop that gate).
do $$
declare
  r record;
  d text;
  nd text;
  anchor constant text := 'from\s+item_catalog\s+c\s+join\s+latest\s+l\s+on\s+l\.company\s*=\s*c\.company\s+and\s+c\.synced_at\s*>=\s*l\.m\s*-\s*interval\s*''2 hours''';
  tail   constant text := 'where\s+c\.company\s*=\s*any\(acc\.companies\)\s+and\s+nullif\(btrim\(c\.tablet_cat\),\s*''''\)\s+is\s+not\s+null\s*;';
begin
  select p.oid into r from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'get_item_index' and p.prokind = 'f';
  if not found then raise exception 'get_item_index not found'; end if;
  d := pg_get_functiondef(r.oid);
  if d !~ anchor then raise exception 'get_item_index: from/join anchor not found'; end if;
  if d !~ tail then raise exception 'get_item_index: where anchor not found'; end if;

  nd := regexp_replace(d, anchor,
$q$from (
    select c0.company, c0.sku, c0.tablet_cat
    from item_catalog c0
    join latest l on l.company = c0.company and c0.synced_at >= l.m - interval '2 hours'
    where c0.company = any(acc.companies) and nullif(btrim(c0.tablet_cat), '') is not null
    union all
    select p0.company, p0.sku, null::text
    from item_pricing p0
    where p0.company = any(acc.companies)
      and not exists (select 1 from item_catalog k where k.company = p0.company and nullif(btrim(k.tablet_cat), '') is not null)
  ) c$q$);
  nd := regexp_replace(nd, tail, 'where c.company = any(acc.companies);');
  execute nd;
end $$;
