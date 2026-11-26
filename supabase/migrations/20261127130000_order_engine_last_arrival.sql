-- Order recommendation: show the item's last arrival, B8 import or 76 local purchase (owner request 2026-11-26).
--
-- The engine already has last_import_date / last_import_qty, but those are B8 imports only and they drive the B8-window
-- check (b8_rate / b8_flag), so they stay exactly as they are. Four new output columns:
--   last_in_date   date of the latest arrival (stock_moves, move_kind import or local_purchase, qty > 0)
--   last_in_qty    pieces on that document for the item (all positive lines of the same document, date and kind)
--   last_in_kind   'B8' (import) or '76' (local purchase)
--   last_in_doc    the document number
-- Negative 76 lines (returns to the supplier) are not arrivals and are ignored.
-- Same in-place patch pattern as 20261127110000 (exact-text replace, fails loudly if the text is not found).
do $mig$
declare
  d text;
  r_ret  constant text := 'rate_old numeric, sell_threshold numeric)';
  r_sel  constant text := 'w.sell_threshold
    from withset w';
  r_join constant text := 'left join runout ro on ro.sku = w.sku
   where (w.stock';
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p
   where p.proname = 'order_engine' and p.pronamespace = 'public'::regnamespace
     and pg_get_function_identity_arguments(p.oid) = 'p_company text, p_today date, p_include_hidden boolean';
  if d is null then raise exception 'order_engine not found'; end if;
  if position('last_in_date' in d) > 0 then return; end if;   -- already patched
  if position(r_ret in d) = 0 or position(r_sel in d) = 0 or position(r_join in d) = 0 then
    raise exception 'order_engine text is not as expected; not patched';
  end if;

  d := replace(d, r_ret, 'rate_old numeric, sell_threshold numeric, last_in_date date, last_in_qty numeric, last_in_kind text, last_in_doc text)');
  d := replace(d, r_sel, 'w.sell_threshold, la.move_date, la.qty, la.kind, la.doc_num
    from withset w');
  d := replace(d, r_join, 'left join runout ro on ro.sku = w.sku
    left join (
      select y.sku, y.move_date, case y.kind when ''import'' then ''B8'' else ''76'' end as kind, y.doc_num, sum(mv.qty) as qty
        from (select distinct on (m.item_sku) m.item_sku as sku, m.move_date, m.move_kind as kind, m.doc_num
                from stock_moves m
               where m.company = p_company and m.qty > 0 and m.move_kind in (''import'', ''local_purchase'')
               order by m.item_sku, m.move_date desc, m.id desc) y
        join stock_moves mv on mv.company = p_company and mv.item_sku = y.sku and mv.move_date = y.move_date
                           and mv.move_kind = y.kind and mv.doc_num is not distinct from y.doc_num and mv.qty > 0
       group by y.sku, y.move_date, y.kind, y.doc_num
    ) la on la.sku = w.sku
   where (w.stock');

  execute 'drop function public.order_engine(text, date, boolean)';
  execute d;
  execute 'revoke all on function public.order_engine(text, date, boolean) from public, anon, authenticated';
  execute 'grant execute on function public.order_engine(text, date, boolean) to service_role';
end
$mig$;
