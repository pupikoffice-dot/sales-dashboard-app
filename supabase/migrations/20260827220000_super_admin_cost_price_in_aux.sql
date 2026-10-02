-- Super admins always receive cost/price in get_dashboard_aux, matching the client
-- canShowItemCost / canShowClientProfit bypass. Previously only acc.show_item_cost
-- gated costRows even for super_admin users with an explicit access row.

create or replace function public.get_dashboard_aux()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access;
  res jsonb;
  v_debt jsonb; v_wms jsonb; v_cost jsonb; v_price jsonb;
  v_upd text; v_sync jsonb; v_debt_dates jsonb;
  v_receipts jsonb; v_receipts_ag jsonb;
  can_see_receipts boolean;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null then
    return jsonb_build_object(
      'debtRows','[]'::jsonb,'wmsRows','[]'::jsonb,'costRows','[]'::jsonb,'priceRows','[]'::jsonb,
      'syncTimes','{}'::jsonb
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'company', company, 'agent', coalesce(agent_erp_id,''), 'clientID', erp_client_id,
           'clientName', coalesce(client_name,''), 'oldDebt', old_debt, 'months', months)), '[]'::jsonb)
    into v_debt
  from (
    select company, agent_erp_id, erp_client_id, max(client_name) as client_name,
           coalesce(sum(amount) filter (where note = 'old'), 0) as old_debt,
           coalesce(
             jsonb_agg(jsonb_build_object('label', to_char(bucket_date,'Mon YYYY'), 'amount', amount)
                       order by bucket_date) filter (where note is distinct from 'old'),
             '[]'::jsonb) as months
    from client_debt_lines
    where company = any(acc.companies)
      and (acc.agents is null or array_length(acc.agents,1) is null or agent_erp_id = any(acc.agents))
    group by company, agent_erp_id, erp_client_id
  ) d;

  select coalesce(jsonb_agg(jsonb_build_object(
           'company', company, 'itemSKU', sku, 'qtyInStock', qty_on_hand, 'itemName', name)), '[]'::jsonb)
    into v_wms
  from inventory where company = any(acc.companies);

  if acc.show_item_cost or is_super_admin() then
    select coalesce(jsonb_agg(jsonb_build_object('company', company, 'itemSKU', sku, 'cost', cost)), '[]'::jsonb)
      into v_cost from item_pricing_admin where company = any(acc.companies) and cost is not null;
  else v_cost := '[]'::jsonb; end if;

  if acc.show_client_profit or is_super_admin() then
    select coalesce(jsonb_agg(jsonb_build_object('company', company, 'itemSKU', sku, 'price', list_price)), '[]'::jsonb)
      into v_price from item_pricing where company = any(acc.companies) and list_price is not null;
  else v_price := '[]'::jsonb; end if;

  select to_char(max(synced_at) at time zone 'Asia/Jerusalem','DD/MM/YYYY HH24:MI') into v_upd
  from client_debt_lines where company = any(acc.companies);

  select coalesce(jsonb_object_agg(company, to_char(file_date,'DD/MM/YYYY')), '{}'::jsonb)
    into v_debt_dates
  from debt_meta where company = any(acc.companies) and file_date is not null;

  can_see_receipts := is_super_admin() or exists (
    select 1
    from public.app_user_class uc
    join public.app_grant g
      on g.class_id = uc.class_id
     and g.user_id is null
    where uc.user_id = auth.uid()
      and g.kind = 'node'
      and g.effect = 'allow'
      and g.key like 'ui.oversight.suite.%'
  );

  if can_see_receipts then
    select coalesce(jsonb_object_agg(company, months), '{}'::jsonb) into v_receipts from (
      select company, jsonb_object_agg(ym, total) as months from (
        select company, to_char(collected_date, 'YYYY-MM') as ym, sum(cash_gross) as total
        from receipt_lines
        where company = any(acc.companies)
          and (acc.agents is null or array_length(acc.agents,1) is null or agent_erp_id = any(acc.agents))
        group by 1, 2
      ) m group by company
    ) r;
    select coalesce(jsonb_object_agg(company, agents), '{}'::jsonb) into v_receipts_ag from (
      select company, jsonb_object_agg(agent, months) as agents from (
        select company, coalesce(agent_erp_id,'') as agent, jsonb_object_agg(ym, total) as months from (
          select company, agent_erp_id, to_char(collected_date, 'YYYY-MM') as ym, sum(cash_gross) as total
          from receipt_lines
          where company = any(acc.companies)
            and (acc.agents is null or array_length(acc.agents,1) is null or agent_erp_id = any(acc.agents))
          group by 1, 2, 3
        ) a group by company, agent_erp_id
      ) g group by company
    ) r2;
  else
    v_receipts := '{}'::jsonb;
    v_receipts_ag := '{}'::jsonb;
  end if;

  select coalesce(jsonb_object_agg(company, segmap), '{}'::jsonb) into v_sync from (
    select company, jsonb_object_agg(seg, ts) as segmap from (
      select company, seg, max(ts) as ts from (
        select company,
          case when line_source ilike 'rep891%' then 'sales'
               when line_source = '722-order' then 'orders'
               when line_source = '721-open-order' then 'openorders'
               when line_source = '720-open-delivery' then 'delivery'
               when line_source = '855' then 'returns' end as seg,
          synced_at as ts
        from sales_lines
        where company = any(acc.companies)
          and (line_source ilike 'rep891%' or line_source in ('722-order','721-open-order','720-open-delivery','855'))
        union all
        select company, 'debt' as seg, synced_at as ts
        from client_debt_lines where company = any(acc.companies)
      ) u where seg is not null
      group by company, seg
    ) s group by company
  ) t;

  res := jsonb_build_object(
    'debtRows', v_debt, 'wmsRows', v_wms, 'costRows', v_cost, 'priceRows', v_price,
    'debtLastUpdate', coalesce(v_upd,''), 'debtFileDates', v_debt_dates,
    'receiptsMonthly', v_receipts, 'receiptsMonthlyByAgent', v_receipts_ag,
    'syncTimes', v_sync
  );
  return res;
end;
$function$;

grant execute on function public.get_dashboard_aux() to authenticated;
