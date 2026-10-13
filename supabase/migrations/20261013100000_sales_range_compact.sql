-- Compact sales page for faster loads (mobile Oversight took ~30 s).
-- Same row universe, access rules and values as get_dashboard_sales_range, but
-- sent column by column: every text value (company tag, date, agent, client,
-- doc, sku, item name, categories, supplier) is replaced by an index into one
-- per-page string dictionary. Cuts the JSON several times over and parses much
-- faster on phones. The client decodes back to the exact v1 row objects.
-- v1 stays in place (older bundles and the fallback path still call it).
create or replace function public.get_dashboard_sales_range_v2(p_from_id bigint, p_to_id bigint)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
 set work_mem to '64MB'
as $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null then
    return jsonb_build_object('v', 2, 'n', 0, 'dict', '[]'::jsonb);
  end if;

  with page as (
    select s.id,
      case
        when s.line_source ilike 'rep891%' then s.company
        when s.line_source = '722-order' then 'orders-'||s.company
        when s.line_source = '721-open-order' then case when s.company='pupik' then 'openorders' else 'openorders-'||s.company end
        when s.line_source = '720-open-delivery' then 'delivery720-'||s.company
        when s.line_source = '855' then 'returns-'||s.company
      end as company,
      to_char(s.line_date,'YYYY-MM-DD') as d,
      s.year, s.month,
      s.agent_erp_id as agent, s.client_id, s.client_name, s.doc_num, s.item_sku, s.item_name,
      s.qty, s.cash,
      coalesce(nullif(s.tablet_cat, ''), ic.tablet_cat) as tablet_cat,
      coalesce(nullif(s.group_cat, ''),  ic.group_cat)  as group_cat,
      case
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
      end as supplier
    from sales_lines s
    left join item_catalog ic on ic.company = s.company and ic.sku = s.item_sku
    left join supplier_prefix sp on sp.prefix = upper(split_part(s.item_sku,'-',1))
    where s.id >= p_from_id and s.id <= p_to_id
      and s.company = any(acc.companies)
      and (acc.agents is null or array_length(acc.agents,1) is null or s.agent_erp_id = any(acc.agents))
      and (s.line_source ilike 'rep891%'
           or s.line_source in ('722-order','721-open-order','720-open-delivery','855'))
  ),
  strs as (
    select distinct x.v
    from page p
    cross join lateral (values
      (p.company), (p.d), (p.agent), (p.client_id), (p.client_name), (p.doc_num),
      (p.item_sku), (p.item_name), (p.tablet_cat), (p.group_cat), (p.supplier)
    ) as x(v)
    where x.v is not null
  ),
  dict as (
    select v, (row_number() over () - 1)::int as i from strs
  )
  select jsonb_build_object(
    'v', 2,
    'n', count(p.id),
    'dict', (select coalesce(jsonb_agg(v order by i), '[]'::jsonb) from dict),
    'company',    coalesce(jsonb_agg(k_co.i  order by p.id), '[]'::jsonb),
    'date',       coalesce(jsonb_agg(k_d.i   order by p.id), '[]'::jsonb),
    'year',       coalesce(jsonb_agg(p.year  order by p.id), '[]'::jsonb),
    'month',      coalesce(jsonb_agg(p.month order by p.id), '[]'::jsonb),
    'agent',      coalesce(jsonb_agg(k_ag.i  order by p.id), '[]'::jsonb),
    'clientID',   coalesce(jsonb_agg(k_ci.i  order by p.id), '[]'::jsonb),
    'clientName', coalesce(jsonb_agg(k_cn.i  order by p.id), '[]'::jsonb),
    'docNum',     coalesce(jsonb_agg(k_dn.i  order by p.id), '[]'::jsonb),
    'itemSKU',    coalesce(jsonb_agg(k_sk.i  order by p.id), '[]'::jsonb),
    'itemName',   coalesce(jsonb_agg(k_in.i  order by p.id), '[]'::jsonb),
    'qty',        coalesce(jsonb_agg(p.qty   order by p.id), '[]'::jsonb),
    'cash',       coalesce(jsonb_agg(p.cash  order by p.id), '[]'::jsonb),
    'tabletCat',  coalesce(jsonb_agg(k_tc.i  order by p.id), '[]'::jsonb),
    'groupCat',   coalesce(jsonb_agg(k_gc.i  order by p.id), '[]'::jsonb),
    'supplier',   coalesce(jsonb_agg(k_su.i  order by p.id), '[]'::jsonb)
  ) into res
  from page p
  left join dict k_co on k_co.v = p.company
  left join dict k_d  on k_d.v  = p.d
  left join dict k_ag on k_ag.v = p.agent
  left join dict k_ci on k_ci.v = p.client_id
  left join dict k_cn on k_cn.v = p.client_name
  left join dict k_dn on k_dn.v = p.doc_num
  left join dict k_sk on k_sk.v = p.item_sku
  left join dict k_in on k_in.v = p.item_name
  left join dict k_tc on k_tc.v = p.tablet_cat
  left join dict k_gc on k_gc.v = p.group_cat
  left join dict k_su on k_su.v = p.supplier;
  return res;
end;
$function$;

revoke all on function public.get_dashboard_sales_range_v2(bigint, bigint) from public, anon;
grant execute on function public.get_dashboard_sales_range_v2(bigint, bigint) to authenticated;
