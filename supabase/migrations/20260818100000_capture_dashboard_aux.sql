-- DRIFT CAPTURE (verbatim copy of the live definition; applying this is a no-op).
--
-- get_dashboard_aux is the single call returning everything that is NOT sales rows:
-- debt, warehouse stock, cost, price, receipts and per-segment sync times. It was
-- never tracked in any migration despite being on the critical path of every page
-- load. Captured here EXACTLY as it runs in production -- deliberately including
-- the flaws below, so that applying this file cannot change behaviour.
--
-- KNOWN ISSUES, intentionally NOT fixed here (fix in a separate, reviewable change):
--   1. No `SET search_path`. Every other SECURITY DEFINER function in this schema
--      pins it. A mutable search_path on a definer function is a privilege-
--      escalation vector and should be pinned to 'public'.
--   2. Depends on dashboard_user_access.show_item_cost / show_client_profit, which
--      is why 20260812000000 must run before this.
--
-- NOTE for the permission re-architecture: contrary to an early reading of the
-- client code, this function ALREADY enforces server-side (a) company+agent scoping
-- on debt rows, (b) cost/price field masking, and (c) a super-admin gate on receipts.
-- The client-side filterDebtRows / canShowItemCost checks are a redundant second
-- pass, not the only defence.
CREATE OR REPLACE FUNCTION public.get_dashboard_aux()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET statement_timeout TO '30s'
AS $function$
declare acc dashboard_user_access; res jsonb; v_debt jsonb; v_wms jsonb; v_cost jsonb; v_price jsonb; v_upd text; v_sync jsonb; v_debt_dates jsonb; v_receipts jsonb; v_receipts_ag jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null then return jsonb_build_object('debtRows','[]'::jsonb,'wmsRows','[]'::jsonb,'costRows','[]'::jsonb,'priceRows','[]'::jsonb,'syncTimes','{}'::jsonb); end if;

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

  if acc.show_item_cost then
    select coalesce(jsonb_agg(jsonb_build_object('company', company, 'itemSKU', sku, 'cost', cost)), '[]'::jsonb)
      into v_cost from item_pricing_admin where company = any(acc.companies) and cost is not null;
  else v_cost := '[]'::jsonb; end if;

  if acc.show_client_profit then
    select coalesce(jsonb_agg(jsonb_build_object('company', company, 'itemSKU', sku, 'price', list_price)), '[]'::jsonb)
      into v_price from item_pricing where company = any(acc.companies) and list_price is not null;
  else v_price := '[]'::jsonb; end if;

  select to_char(max(synced_at) at time zone 'Asia/Jerusalem','DD/MM/YYYY HH24:MI') into v_upd
  from client_debt_lines where company = any(acc.companies);

  select coalesce(jsonb_object_agg(company, to_char(file_date,'DD/MM/YYYY')), '{}'::jsonb)
    into v_debt_dates
  from debt_meta where company = any(acc.companies) and file_date is not null;

  -- Receipts (008): super-admin only. Gross monthly sums per company keyed
  -- 'YYYY-MM' (frontend nets 18% VAT), plus per-agent breakdown for
  -- team-scoped charts.
  if is_super_admin() then
    select coalesce(jsonb_object_agg(company, months), '{}'::jsonb) into v_receipts from (
      select company, jsonb_object_agg(ym, total) as months from (
        select company, to_char(collected_date, 'YYYY-MM') as ym, sum(cash_gross) as total
        from receipt_lines where company = any(acc.companies)
        group by 1, 2
      ) m group by company
    ) r;
    select coalesce(jsonb_object_agg(company, agents), '{}'::jsonb) into v_receipts_ag from (
      select company, jsonb_object_agg(agent, months) as agents from (
        select company, coalesce(agent_erp_id,'') as agent, jsonb_object_agg(ym, total) as months from (
          select company, agent_erp_id, to_char(collected_date, 'YYYY-MM') as ym, sum(cash_gross) as total
          from receipt_lines where company = any(acc.companies)
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

  res := jsonb_build_object('debtRows', v_debt, 'wmsRows', v_wms, 'costRows', v_cost, 'priceRows', v_price,
                            'debtLastUpdate', coalesce(v_upd,''), 'debtFileDates', v_debt_dates,
                            'receiptsMonthly', v_receipts, 'receiptsMonthlyByAgent', v_receipts_ag,
                            'syncTimes', v_sync);
  return res;
end;
$function$;
