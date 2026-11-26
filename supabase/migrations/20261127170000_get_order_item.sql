-- Item card: the Order recommendation numbers for ONE item, whatever its status (the page list only returns items
-- that need an order). Same access rule as the Order recommendation page. Returns null when the user has no access,
-- {"row": null} when the engine does not list the item (no stock and fewer than 3 selling months in the last 12).
create or replace function public.get_order_item(p_company text, p_sku text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '60s'
as $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := rnd_gate(p_company, p_as, 'rnd_order_reco');
  if acc.user_id is null then return null; end if;
  select jsonb_build_object('row', (select to_jsonb(e) from order_engine(p_company, current_date, true) e where e.sku = p_sku limit 1))
    into res;
  return res;
end;
$function$;
revoke all on function public.get_order_item(text, text, uuid) from public, anon;
grant execute on function public.get_order_item(text, text, uuid) to authenticated;
