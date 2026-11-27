-- Item cost for item details / item index: the cost in the item index (REP907) is the latest supplier-invoice cost, because each
-- B8 / 76 posting in the ERP updates it. This RPC returns that number plus the past import costs of the SAME company for the hover
-- table (date, unit cost = value / qty, qty, doc). No averages, no other company's data. Only users who may see item costs.
create or replace function public.get_item_cost_history(p_company text, p_sku text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null or not (acc.show_item_cost or is_super_admin()) then return null; end if;
  if p_company is null or not (p_company = any(acc.companies)) then return null; end if;
  select jsonb_build_object(
    'cost', (select a.cost from item_pricing_admin a where a.company = p_company and a.sku = p_sku and a.cost > 0 limit 1),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('date', to_char(h.move_date, 'YYYY-MM-DD'), 'cost', round(h.uc, 4), 'qty', h.qty, 'doc', h.doc_num)
                       order by h.move_date desc, h.doc_num desc)
      from (
        select m.move_date, m.doc_num, sum(m.qty) as qty, sum(m.cash) / sum(m.qty) as uc
        from stock_moves m
        where m.company = p_company and m.item_sku = p_sku and m.move_kind = 'import' and m.qty > 0 and m.cash > 0
        group by m.move_date, m.doc_num
        order by m.move_date desc, m.doc_num desc
        limit 30
      ) h), '[]'::jsonb))
  into res;
  return res;
end;
$function$;
revoke all on function public.get_item_cost_history(text, text) from public, anon;
grant execute on function public.get_item_cost_history(text, text) to authenticated;
