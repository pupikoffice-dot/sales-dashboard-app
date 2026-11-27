-- Deals per Range: leave out Pupik client 2100513 ("תרומה" = donation, ~2,950 invoices), which is not a real sale.
-- The same client number in Goldbug / Grow is a different, real client and stays in.
create or replace function public.deals_docs(p_company text, p_hidden int[])
returns table(doc_type text, doc_num text, doc_date date, client_id text, client_name text, total numeric, n_lines int)
language sql stable security definer set search_path to 'public'
as $$
  select s.doc_type, s.doc_num, max(s.line_date) as doc_date, max(s.client_id) as client_id, max(s.client_name) as client_name,
         sum(s.cash) as total, count(*)::int as n_lines
  from sales_lines s
  where s.company = p_company and s.line_source like 'rep891%'
    and s.doc_type between '11' and '19' and s.doc_num is not null
    and s.line_date >= (date_trunc('month', (now() at time zone 'Asia/Jerusalem')::date) - interval '12 months')::date
    and s.year <> all(coalesce(p_hidden, '{}'::int[]))
    and not (p_company = 'pupik' and s.client_id = '2100513')
  group by s.doc_type, s.doc_num
  having sum(s.cash) > 0;
$$;
revoke all on function public.deals_docs(text, int[]) from public, anon, authenticated;
