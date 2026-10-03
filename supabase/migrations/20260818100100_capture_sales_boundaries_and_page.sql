-- DRIFT CAPTURE (verbatim copies of the live definitions; applying this is a no-op).
--
-- get_dashboard_sales_boundaries: computes the id checkpoints the client uses to
-- fetch sales in ~25k-row chunks. On the critical path of every page load, never
-- tracked in a migration until now.
--
-- get_dashboard_sales_page: an OFFSET/LIMIT pager, superseded by the id-range
-- fetch (get_dashboard_sales_range) that the app actually uses. Captured for
-- completeness because it exists in production and is still callable by any
-- authenticated user. Note it reads s.tablet_cat / s.group_cat / s.supplier
-- DIRECTLY, without the item_catalog join and supplier-prefix resolution that
-- 20260805010000 / 20260810030000 added to get_dashboard_sales_range -- so it
-- returns the pre-fix, mostly-empty category and supplier values. It is a
-- deprecation candidate; do not build anything new on it.
CREATE OR REPLACE FUNCTION public.get_dashboard_sales_boundaries(p_page_rows integer DEFAULT 25000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '30s'
AS $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null then return jsonb_build_object('boundaries', '[]'::jsonb, 'max_id', null); end if;

  with ids as (
    select s.id, row_number() over (order by s.id) as rn
    from sales_lines s
    where s.company = any(acc.companies)
      and (acc.agents is null or array_length(acc.agents,1) is null or s.agent_erp_id = any(acc.agents))
      and (s.line_source ilike 'rep891%'
           or s.line_source in ('722-order','721-open-order','720-open-delivery','855'))
  )
  select jsonb_build_object(
           'boundaries', coalesce(jsonb_agg(id order by id) filter (where rn % p_page_rows = 1), '[]'::jsonb),
           'max_id', max(id))
    into res from ids;
  return res;
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_dashboard_sales_page(p_offset integer DEFAULT 0, p_limit integer DEFAULT 10000)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(obj order by rid), '[]'::jsonb) into res from (
    select s.id as rid, jsonb_build_object(
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
      'tabletCat', s.tablet_cat, 'groupCat', s.group_cat, 'supplier', s.supplier, 'brand', s.brand
    ) as obj
    from sales_lines s
    where s.company = any(acc.companies)
      and (acc.agents is null or array_length(acc.agents,1) is null or s.agent_erp_id = any(acc.agents))
      and (s.line_source ilike 'rep891%'
           or s.line_source in ('722-order','721-open-order','720-open-delivery','855'))
    order by s.id
    offset p_offset limit p_limit
  ) q;

  return res;
end;
$function$;
