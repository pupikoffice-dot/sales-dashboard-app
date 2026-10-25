-- R&D -> Yearly data: one company, year by year: sales, returns, receivables (receipts), imports, brand sales, brand imports.
--   sales      = purchase_facts cash_sold - cash_returned (net invoiced revenue); sold = revenue including the returns
--   returns    = document 14 credit invoices (see refresh_purchase_facts); rate = returns / sold
--   receivables = receipt_lines cash_gross by collection year (the 008 collection report)
--   imports    = stock_moves of kind 'import' (B8 documents): pieces and value (value only where the export carried it)
--   brands     = the supplier name of the SKU prefix, top 15 by total; the rest are summed as 'Other'
-- Company-level numbers, so a user limited to agents gets nothing (they have the client and item cards instead).
-- Access: super admin, or a user holding the R&D section module; companies, hidden years and View-as (p_as) as everywhere.

alter table public.stock_moves add column if not exists cash numeric;

create or replace function public.rnd_gate(p_company text, p_as uuid default null)
returns dashboard_user_access
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare acc dashboard_user_access; previewing boolean;
begin
  previewing := p_as is not null and p_as <> auth.uid() and is_super_admin();
  acc := get_dashboard_access(case when previewing then p_as else auth.uid() end);
  if acc.user_id is null or p_company is null or not (p_company = any(acc.companies)) then return null; end if;
  if acc.agents is not null and array_length(acc.agents, 1) is not null then return null; end if;
  if not ((not previewing and is_super_admin()) or 'rnd' = any(coalesce(acc.modules, '{}'))) then return null; end if;
  return acc;
end;
$function$;
revoke all on function public.rnd_gate(text, uuid) from public, anon, authenticated;

create or replace function public.get_yearly_overview(p_company text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '60s'
as $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := rnd_gate(p_company, p_as);
  if acc.user_id is null then return null; end if;

  with brand_of as (
    select f.year, f.cash_sold, f.cash_returned, f.qty_sold, f.qty_returned,
           case when left(f.item_sku, 1) = '*' or upper(split_part(f.item_sku, '-', 1)) ~ '^[0-9]+$' then '(no brand)'
                else coalesce(sp.supplier_name, nullif(upper(split_part(f.item_sku, '-', 1)), ''), '(no brand)') end as brand
    from purchase_facts f
    left join supplier_prefix sp on sp.prefix = upper(split_part(f.item_sku, '-', 1))
    where f.company = p_company and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
  ),
  yearly as (
    select year, sum(cash_sold) as sold, sum(cash_returned) as returned, sum(qty_sold) as qty_sold, sum(qty_returned) as qty_returned
    from brand_of group by year
  ),
  receipts as (
    select extract(year from collected_date)::int as year, sum(cash_gross) as cash
    from receipt_lines
    where company = p_company and extract(year from collected_date)::int <> all(coalesce(acc.hidden_years, '{}'::int[]))
    group by 1
  ),
  imp as (
    select extract(year from m.move_date)::int as year, m.item_sku, m.qty, m.cash, m.doc_num,
           case when left(m.item_sku, 1) = '*' or upper(split_part(m.item_sku, '-', 1)) ~ '^[0-9]+$' then '(no brand)'
                else coalesce(sp.supplier_name, nullif(upper(split_part(m.item_sku, '-', 1)), ''), '(no brand)') end as brand
    from stock_moves m
    left join supplier_prefix sp on sp.prefix = upper(split_part(m.item_sku, '-', 1))
    where m.company = p_company and m.move_kind = 'import'
      and extract(year from m.move_date)::int <> all(coalesce(acc.hidden_years, '{}'::int[]))
  ),
  imp_year as (
    select year, sum(qty) as qty, sum(cash) as value, count(distinct doc_num) as docs from imp group by year
  ),
  bs_total as (
    select brand, sum(cash_sold - cash_returned) as total from brand_of group by brand
  ),
  bs_rank as (
    select brand, row_number() over (order by total desc nulls last) as rn from bs_total
  ),
  bs as (
    select b.year, case when r.rn <= 15 then b.brand else 'Other' end as brand,
           sum(b.cash_sold - b.cash_returned) as net, sum(b.cash_returned) as returned, sum(b.qty_sold - b.qty_returned) as qty
    from brand_of b join bs_rank r on r.brand = b.brand
    group by 1, 2
  ),
  bi_total as (
    select brand, sum(qty) as total from imp group by brand
  ),
  bi_rank as (
    select brand, row_number() over (order by total desc nulls last) as rn from bi_total
  ),
  bi as (
    select i.year, case when r.rn <= 15 then i.brand else 'Other' end as brand, sum(i.qty) as qty, sum(i.cash) as value
    from imp i join bi_rank r on r.brand = i.brand
    group by 1, 2
  )
  select jsonb_build_object(
    'years', coalesce((select jsonb_agg(jsonb_build_object('year', year, 'sold', sold, 'returned', returned,
                 'qtySold', qty_sold, 'qtyReturned', qty_returned) order by year) from yearly), '[]'::jsonb),
    'receipts', coalesce((select jsonb_agg(jsonb_build_object('year', year, 'cash', cash) order by year) from receipts), '[]'::jsonb),
    'imports', coalesce((select jsonb_agg(jsonb_build_object('year', year, 'qty', qty, 'value', value, 'docs', docs) order by year) from imp_year), '[]'::jsonb),
    'brandSales', coalesce((select jsonb_agg(jsonb_build_object('year', year, 'brand', brand, 'net', net, 'returned', returned, 'qty', qty)) from bs), '[]'::jsonb),
    'brandImports', coalesce((select jsonb_agg(jsonb_build_object('year', year, 'brand', brand, 'qty', qty, 'value', value)) from bi), '[]'::jsonb)
  ) into res;
  return res;
end;
$function$;
grant execute on function public.get_yearly_overview(text, uuid) to authenticated;
