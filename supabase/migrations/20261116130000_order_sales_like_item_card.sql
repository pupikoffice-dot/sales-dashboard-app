-- The "3M" and "12M" sales columns now use the same windows as the Item card, so both screens show the same number:
--   12M = this month so far + the previous 11 months, pieces sold (gross)
--    3M = this month so far + the previous 2 months, pieces sold minus returns
-- Rewrites the rawm part of order_engine in place (keeps its settings: timeout, enable_nestloop off, custom plans).
do $do$
declare d text; a int; b int; new_rawm text;
begin
  d := pg_get_functiondef('public.order_engine(text,date,boolean)'::regprocedure);
  a := position('rawm as (' in d);
  b := position('lastimp as (' in d);
  if a = 0 or b = 0 or b < a then raise exception 'order_engine layout not as expected'; end if;
  new_rawm := $t$ret3 as (
    select f.item_sku as sku, sum(f.qty_returned) as ret3
      from purchase_facts f
     where f.company = p_company and f.item_sku is not null
       and make_date(f.year, f.month, 1) >= (m0 - interval '2 months')::date
       and make_date(f.year, f.month, 1) <= m0
     group by f.item_sku
  ),
  rawm as (   -- plain sales (not trimmed), same windows as the Item card: this month so far, last month, 3 and 12 months counting this one
    select p.sku,
           coalesce(sum(p.q) filter (where p.mth = m0), 0) as s_cur,
           coalesce(sum(p.q) filter (where p.mth = (m0 - interval '1 month')::date), 0) as s_last,
           coalesce(sum(p.q) filter (where p.mth >= (m0 - interval '2 months')::date and p.mth <= m0), 0) - coalesce(max(r.ret3), 0) as s_3m,
           coalesce(sum(p.q) filter (where p.mth >= (m0 - interval '11 months')::date and p.mth <= m0), 0) as s_12m
      from pf p
      left join ret3 r on r.sku = p.sku
     group by p.sku
  ),
  $t$;
  d := substr(d, 1, a - 1) || new_rawm || substr(d, b);
  execute d;
end
$do$;
