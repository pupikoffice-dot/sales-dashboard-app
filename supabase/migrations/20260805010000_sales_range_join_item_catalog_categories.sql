-- Restore the per-row enrichment the legacy Excel macro (ProcessRepTabOptimized)
-- did before export, which the Supabase pipeline had been dropping:
--   * tabletCat  <- item103 category (col I)  -> item_catalog.tablet_cat
--   * groupCat   <- item103 category (col G)  -> item_catalog.group_cat
--   * supplier   <- LEFT(SKU, 4)
-- sales_lines does not store these (they are derived), so tabletCat/groupCat/
-- supplier came back null for every row, collapsing the Sales "Items by
-- category" view and the category/supplier filters to "(No Category)".
-- brand was empty in the legacy output too, so it is intentionally left as-is.
--
-- This mirrors the definition applied to the live project on 2026-08-05 while
-- finishing the Excel cutover. The get_dashboard_sales_* RPCs were originally
-- created out-of-band (never tracked in a migration); this file captures the
-- corrected get_dashboard_sales_range so the fix is reproducible from source.
create or replace function public.get_dashboard_sales_range(p_from_id bigint, p_to_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null then return jsonb_build_object('rows', '[]'::jsonb); end if;

  with page as (
    select s.id, jsonb_build_object(
      'company', case
        when s.line_source ilike 'rep891%' then s.company
        when s.line_source = '722-order' then 'orders-'||s.company
        when s.line_source = '721-open-order' then case when s.company='pupik' then 'openorders' else 'openorders-'||s.company end
        when s.line_source = '720-open-delivery' then 'delivery720-'||s.company
        when s.line_source = '855' then 'returns-'||s.company
      end,
      'date', to_char(s.line_date,'YYYY-MM-DD'),
      'year', s.year, 'month', s.month,
      'agent', s.agent_erp_id, 'clientID', s.client_id, 'clientName', s.client_name,
      'docType', s.doc_type, 'docNum', s.doc_num, 'itemSKU', s.item_sku, 'barcode', s.barcode,
      'itemName', s.item_name, 'qty', s.qty, 'cash', s.cash,
      'tabletCat', coalesce(nullif(s.tablet_cat, ''), ic.tablet_cat),
      'groupCat',  coalesce(nullif(s.group_cat, ''),  ic.group_cat),
      'supplier',  coalesce(nullif(s.supplier, ''),
                            case when length(s.item_sku) >= 4 then upper(left(s.item_sku, 4))
                                 when s.item_sku is not null then upper(s.item_sku) end),
      'brand', s.brand
    ) as obj
    from sales_lines s
    left join item_catalog ic on ic.company = s.company and ic.sku = s.item_sku
    where s.id >= p_from_id and s.id <= p_to_id
      and s.company = any(acc.companies)
      and (acc.agents is null or array_length(acc.agents,1) is null or s.agent_erp_id = any(acc.agents))
      and (s.line_source ilike 'rep891%'
           or s.line_source in ('722-order','721-open-order','720-open-delivery','855'))
    order by s.id
  )
  select jsonb_build_object('rows', coalesce(jsonb_agg(obj order by id), '[]'::jsonb))
    into res from page;
  return res;
end;
$function$;
