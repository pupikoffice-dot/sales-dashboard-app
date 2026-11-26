-- Order recommendation uses the in-stock-days sales rate (item_sellable_rate, migration 20261127100000).
--
-- rate12 (the base rate, per calendar day) becomes: item_sellable_rate's sales / in-stock working days x 5/7 when the
-- item has enough evidence, else the old 12-month rate. Below 40 in-stock days the missing days are filled with the old
-- rate (so a short launch burst cannot multiply the rate). 5/7 turns a per-working-day rate into a per-calendar-day rate,
-- so all of the engine's month, lead-time, cover and safety maths stay as they were.
-- Seasonality: for items with the new rate, a forecast month = new base x trend x (same month last year / last year's
-- average), the ratio clamped to 0.5..2, instead of last year's raw month (which is low wherever the item was out of stock).
-- Items without the new rate keep the old forecast exactly.
-- New output columns (passed straight to the page by get_order_recommendation / get_import_cover):
--   rate_basis      'stock' | 'b8' | 'first_sale' | null (null = old 12-month rate)
--   sellable_days   working days the rate is based on
--   rate_old        the old 12-month base rate (per calendar day), for comparison
--   sell_threshold  stock level above which a day counts as in stock
-- Done by patching the live definition in place (exact-text replace, fails loudly if the text is not found). The return
-- type changes, so the function is dropped and created again, and its grants are revoked again (engine is internal).
do $mig$
declare
  d text;
  old_rate constant text := $t$case when c.first_m <= (m0 - interval '6 months')::date
                then 0.5 * c.q12 / c.d12 + 0.5 * coalesce(c.q6, 0) / (m0 - (m0 - interval '6 months')::date)
                else c.q12 / c.d12 end$t$;
  r_ret  constant text := 'b2_docs text, b6_docs text, sup_hidden boolean)';
  r_join constant text := 'left join b8 bb on bb.sku = c.sku';
  r_fm   constant text := 'case when w.ly_ok then coalesce(ly.q, 0)';
  r_sel  constant text := 'w.b2_docs, w.b6_docs, w.sup_hidden
    from withset w';
  ly_day constant text := $t$(((g.fm_start - interval '12 months')::date + interval '1 month')::date - (g.fm_start - interval '12 months')::date)$t$;
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p
   where p.proname = 'order_engine' and p.pronamespace = 'public'::regnamespace
     and pg_get_function_identity_arguments(p.oid) = 'p_company text, p_today date, p_include_hidden boolean';
  if d is null then raise exception 'order_engine not found'; end if;
  if position('item_sellable_rate' in d) > 0 then return; end if;   -- already patched
  if position(old_rate || ' as rate12' in d) = 0 or position(r_ret in d) = 0 or position(r_join in d) = 0
     or position(r_fm in d) = 0 or position(r_sel in d) = 0 then
    raise exception 'order_engine text is not as expected; not patched';
  end if;

  d := replace(d, r_ret, 'b2_docs text, b6_docs text, sup_hidden boolean, rate_basis text, sellable_days integer, rate_old numeric, sell_threshold numeric)');
  -- Blend (owner decision): until an item has 40 in-stock working days, the missing days are filled with the old rate:
  --   rate = (sales on in-stock days x 5/7 + (40 - days) x old rate) / 40;  from 40 days on: sales / days x 5/7.
  d := replace(d, old_rate || ' as rate12',
         'case when sr.sell_days > 0 then (5.0 / 7 * sr.sell_qty + greatest(0, 40 - sr.sell_days) * (' || old_rate || '))'
         || ' / (sr.sell_days + greatest(0, 40 - sr.sell_days)) else ' || old_rate || ' end as rate12,' || E'\n           ' ||
         old_rate || ' as rate_old,' || E'\n           ' ||
         'sr.basis as rate_basis, sr.sell_days as sellable_days, sr.threshold as sell_threshold');
  d := replace(d, r_join, r_join || E'\n      left join item_sellable_rate(p_company, p_today) sr on sr.sku = c.sku');
  d := replace(d, r_fm,
         'case when w.ly_ok and w.rate_basis is not null and w.rate_y > 0 then w.rate12 * w.trend * least(2, greatest(0.5, coalesce(ly.q, 0) / '
         || ly_day || ' / w.rate_y))' || E'\n                  ' || 'when w.ly_ok then coalesce(ly.q, 0)');
  d := replace(d, r_sel, 'w.b2_docs, w.b6_docs, w.sup_hidden, w.rate_basis, w.sellable_days, round(w.rate_old, 4), w.sell_threshold
    from withset w');

  execute 'drop function public.order_engine(text, date, boolean)';
  execute d;
  execute 'revoke all on function public.order_engine(text, date, boolean) from public, anon, authenticated';
  execute 'grant execute on function public.order_engine(text, date, boolean) to service_role';
end
$mig$;
