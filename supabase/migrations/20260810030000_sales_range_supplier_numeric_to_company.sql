-- Supplier resolution refinement: SKUs whose prefix is numeric-only, or that
-- start with '*', are internal/miscellaneous lines — attribute them to the
-- COMPANY itself (Pupik / Monkeytime / Grow / Gold) rather than a bogus
-- supplier. Everything else resolves via supplier_prefix, then bare prefix.
-- (The frontend hides the company buckets + "Local Sup" from supplier tables.)
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
      'supplier',  case
                     when left(coalesce(s.item_sku,''), 1) = '*'
                          or upper(split_part(coalesce(s.item_sku,''),'-',1)) ~ '^[0-9]+$'
                       then case s.company
                              when 'pupik' then 'Pupik'
                              when 'mt' then 'Monkeytime'
                              when 'grow' then 'Grow'
                              when 'gold' then 'Gold'
                              else initcap(s.company) end
                     else coalesce(nullif(s.supplier, ''), sp.supplier_name,
                                   nullif(upper(split_part(s.item_sku,'-',1)), ''))
                   end,
      'brand', s.brand
    ) as obj
    from sales_lines s
    left join item_catalog ic on ic.company = s.company and ic.sku = s.item_sku
    left join supplier_prefix sp on sp.prefix = upper(split_part(s.item_sku,'-',1))
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
