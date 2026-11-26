-- Order recommendation: show the full item name.
-- The name used to be taken from the inventory file, else from the item's latest sales line. The ERP invoice line cuts the
-- description at about 21 characters, so items without an inventory row showed a cut name ("... G9 שח" instead of "... G9 שחור").
-- Now the order is: item price list name (REP907, the same name the item cards use), then inventory, then the sales line, then the SKU.
-- Done by patching the live definition of order_engine in place (exact-text replace, fails loudly if the text is not found);
-- safe to run twice (a second run does nothing).
do $mig$
declare
  d text;
  d2 text;
  old_join constant text := 'left join inventory i on i.company = p_company and i.sku = c.sku';
  old_name constant text := 'coalesce(i.name, n.item_name, c.sku) as item_name';
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p
   where p.proname = 'order_engine' and p.pronamespace = 'public'::regnamespace
     and pg_get_function_identity_arguments(p.oid) = 'p_company text, p_today date, p_include_hidden boolean';
  if d is null then raise exception 'order_engine(p_company, p_today, p_include_hidden) not found'; end if;
  if position('item_pricing ip' in d) > 0 then return; end if;   -- already patched
  if position(old_join in d) = 0 or position(old_name in d) = 0 then
    raise exception 'order_engine text is not as expected; not patched';
  end if;
  if position(' ip ' in d) > 0 or position(' ip.' in d) > 0 then raise exception 'alias ip already used in order_engine'; end if;
  d2 := replace(d, old_join, old_join || E'\n      left join item_pricing ip on ip.company = p_company and ip.sku = c.sku');
  d2 := replace(d2, old_name, 'coalesce(nullif(btrim(ip.name), ''''), i.name, n.item_name, c.sku) as item_name');
  execute d2;
end
$mig$;
