-- R&D -> Yearly data: one company, one year: totals and month by month (same measures as get_yearly_overview).
-- Same gate as get_yearly_overview (rnd_gate: company, no agent limit, R&D module, View-as) and the same hidden-years rule:
-- a hidden year returns nothing. Brands: top 15 by the year's total, the rest as 'Other'.
create or replace function public.get_yearly_detail(p_company text, p_year int, p_as uuid default null)
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
  if acc.user_id is null or p_year is null then return null; end if;
  if p_year = any(coalesce(acc.hidden_years, '{}'::int[])) then return null; end if;

  with brand_of as (
    select f.month, f.cash_sold, f.cash_returned, f.qty_sold, f.qty_returned,
           case when left(f.item_sku, 1) = '*' or upper(split_part(f.item_sku, '-', 1)) ~ '^[0-9]+$' then '(no brand)'
                else coalesce(sp.supplier_name, nullif(upper(split_part(f.item_sku, '-', 1)), ''), '(no brand)') end as brand
    from purchase_facts f
    left join supplier_prefix sp on sp.prefix = upper(split_part(f.item_sku, '-', 1))
    where f.company = p_company and f.year = p_year
  ),
  sales_m as (
    select month, sum(cash_sold) as sold, sum(cash_returned) as returned, sum(qty_sold) as qty_sold, sum(qty_returned) as qty_returned
    from brand_of group by month
  ),
  rec_m as (
    select extract(month from collected_date)::int as month, sum(cash_gross) as cash
    from receipt_lines
    where company = p_company and extract(year from collected_date)::int = p_year
    group by 1
  ),
  imp as (
    select extract(month from m.move_date)::int as month, m.qty, m.cash, m.doc_num,
           case when left(m.item_sku, 1) = '*' or upper(split_part(m.item_sku, '-', 1)) ~ '^[0-9]+$' then '(no brand)'
                else coalesce(sp.supplier_name, nullif(upper(split_part(m.item_sku, '-', 1)), ''), '(no brand)') end as brand
    from stock_moves m
    left join supplier_prefix sp on sp.prefix = upper(split_part(m.item_sku, '-', 1))
    where m.company = p_company and m.move_kind = 'import' and extract(year from m.move_date)::int = p_year
  ),
  imp_m as (
    select month, sum(qty) as qty, sum(cash) as value, count(distinct doc_num) as docs from imp group by month
  ),
  bs_rank as (
    select brand, row_number() over (order by sum(cash_sold - cash_returned) desc nulls last) as rn from brand_of group by brand
  ),
  bs as (
    select b.month, case when r.rn <= 15 then b.brand else 'Other' end as brand,
           sum(b.cash_sold - b.cash_returned) as net, sum(b.cash_returned) as returned, sum(b.qty_sold - b.qty_returned) as qty
    from brand_of b join bs_rank r on r.brand = b.brand group by 1, 2
  ),
  bi_rank as (
    select brand, row_number() over (order by sum(qty) desc nulls last) as rn from imp group by brand
  ),
  bi as (
    select i.month, case when r.rn <= 15 then i.brand else 'Other' end as brand, sum(i.qty) as qty, sum(i.cash) as value
    from imp i join bi_rank r on r.brand = i.brand group by 1, 2
  )
  select jsonb_build_object(
    'year', p_year,
    'sales', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'sold', sold, 'returned', returned,
                 'qtySold', qty_sold, 'qtyReturned', qty_returned) order by month) from sales_m), '[]'::jsonb),
    'receipts', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'cash', cash) order by month) from rec_m), '[]'::jsonb),
    'imports', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'qty', qty, 'value', value, 'docs', docs) order by month) from imp_m), '[]'::jsonb),
    'importDocs', (select count(distinct doc_num) from imp),
    'brandSales', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'brand', brand, 'net', net, 'returned', returned, 'qty', qty)) from bs), '[]'::jsonb),
    'brandImports', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'brand', brand, 'qty', qty, 'value', value)) from bi), '[]'::jsonb)
  ) into res;
  return res;
end;
$function$;
revoke all on function public.get_yearly_detail(text, int, uuid) from public, anon;
grant execute on function public.get_yearly_detail(text, int, uuid) to authenticated;
