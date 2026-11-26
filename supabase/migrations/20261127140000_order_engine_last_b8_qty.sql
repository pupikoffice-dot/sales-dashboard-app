-- Fix: the last B8 import quantity (last_import_qty, and the B8-window check built on it) read only ONE line of the
-- B8 document. A document can hold several lines of the same item (VTHH-151168: B8 549 = 148 pieces, shown as 4).
-- Now it sums every positive line of that item on the same B8 document and date. Same in-place patch pattern.
do $mig$
declare
  d text;
  r_old constant text := 'lastimp as (
    select distinct on (m.item_sku) m.item_sku as sku, m.move_date, m.qty
      from stock_moves m
     where m.company = p_company and m.move_kind = ''import'' and m.qty > 0 and m.item_sku in (select c.sku from cand c)
     order by m.item_sku, m.move_date desc, m.id desc
  ),';
  r_new constant text := 'lastimp as (   -- last B8 document of the item; qty = all its lines of the item on that document
    select y.sku, y.move_date, sum(mv.qty) as qty
      from (select distinct on (m.item_sku) m.item_sku as sku, m.move_date, m.doc_num
              from stock_moves m
             where m.company = p_company and m.move_kind = ''import'' and m.qty > 0 and m.item_sku in (select c.sku from cand c)
             order by m.item_sku, m.move_date desc, m.id desc) y
      join stock_moves mv on mv.company = p_company and mv.move_kind = ''import'' and mv.qty > 0
                         and mv.item_sku = y.sku and mv.move_date = y.move_date and mv.doc_num is not distinct from y.doc_num
     group by y.sku, y.move_date
  ),';
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p
   where p.proname = 'order_engine' and p.pronamespace = 'public'::regnamespace
     and pg_get_function_identity_arguments(p.oid) = 'p_company text, p_today date, p_include_hidden boolean';
  if d is null then raise exception 'order_engine not found'; end if;
  if position('last B8 document of the item' in d) > 0 then return; end if;   -- already patched
  if position(r_old in d) = 0 then raise exception 'order_engine lastimp text is not as expected; not patched'; end if;
  d := replace(d, r_old, r_new);
  execute d;   -- same return type: create or replace keeps the grants
  execute 'revoke all on function public.order_engine(text, date, boolean) from public, anon, authenticated';
  execute 'grant execute on function public.order_engine(text, date, boolean) to service_role';
end
$mig$;
