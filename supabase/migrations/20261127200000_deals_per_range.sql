-- R&D > Sales specifics > "Deals per Range": number of invoices issued per invoice-total range, per period.
-- A deal = one invoice document (doc_type 11-19 of the 891 report; the report's own line source) whose total is POSITIVE (credit
-- notes / returns never count). Total = sum of the document's lines as in the report. Date = the document's date.
-- Periods (Israel time): this month and this quarter to date, last 90 days, last 365 days, and each of the 12 full months before the
-- current month. Ranges: <=500, 501-1000, 1001-2000, 2001-3000, 3001-5000, 5001-8000, 8001-12000, 12001+.
-- Page access: module rnd_sales_specifics (super admins always), same gate as the other R&D pages.

create or replace function public.deal_range_bucket(p_total numeric)
returns int language sql immutable
as $$
  select case when p_total <= 500 then 1 when p_total <= 1000 then 2 when p_total <= 2000 then 3 when p_total <= 3000 then 4
              when p_total <= 5000 then 5 when p_total <= 8000 then 6 when p_total <= 12000 then 7 else 8 end;
$$;

-- Positive invoice documents since the first day of the month 12 months back. Internal only.
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
  group by s.doc_type, s.doc_num
  having sum(s.cash) > 0;
$$;
revoke all on function public.deals_docs(text, int[]) from public, anon, authenticated;

-- Does a document date fall in the period? keys: month, quarter, d90, d365, m:YYYY-MM
create or replace function public.deal_in_period(p_date date, p_key text)
returns boolean language sql stable
as $$
  with t as (select (now() at time zone 'Asia/Jerusalem')::date as today)
  select case
    when p_key = 'month' then p_date >= date_trunc('month', t.today)::date and p_date <= t.today
    when p_key = 'quarter' then p_date >= date_trunc('quarter', t.today)::date and p_date <= t.today
    when p_key = 'd90' then p_date > t.today - 90 and p_date <= t.today
    when p_key = 'd365' then p_date > t.today - 365 and p_date <= t.today
    when p_key like 'm:%' then to_char(p_date, 'YYYY-MM') = substr(p_key, 3)
    else false end
  from t;
$$;

create or replace function public.get_deals_per_range(p_company text, p_as uuid default null)
returns jsonb
language plpgsql stable security definer set search_path to 'public' set statement_timeout to '60s'
as $function$
declare acc dashboard_user_access; today date; months text[]; res jsonb; keys text[];
begin
  acc := rnd_gate(p_company, p_as, 'rnd_sales_specifics');
  if acc.user_id is null then return null; end if;
  today := (now() at time zone 'Asia/Jerusalem')::date;
  select array_agg(to_char(date_trunc('month', today) - make_interval(months => g), 'YYYY-MM') order by g) into months
    from generate_series(1, 12) g;
  keys := array['month', 'quarter', 'd90', 'd365'] || (select array_agg('m:' || m order by m desc) from unnest(months) m);
  with d as (select * from deals_docs(p_company, acc.hidden_years)),
  c as (
    select deal_range_bucket(d.total) as bucket, k as key, count(*) as n
    from d cross join unnest(keys) k
    where deal_in_period(d.doc_date, k)
    group by 1, 2
  )
  select jsonb_build_object(
    'asOf', today,
    'months', (select jsonb_agg(m order by m desc) from unnest(months) m),
    'counts', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'key', key, 'n', n)) from c), '[]'::jsonb))
  into res;
  return res;
end;
$function$;
revoke all on function public.get_deals_per_range(text, uuid) from public, anon;
grant execute on function public.get_deals_per_range(text, uuid) to authenticated;

-- The invoices behind one cell.
create or replace function public.get_deals_detail(p_company text, p_bucket int, p_period text, p_as uuid default null)
returns jsonb
language plpgsql stable security definer set search_path to 'public' set statement_timeout to '60s'
as $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := rnd_gate(p_company, p_as, 'rnd_sales_specifics');
  if acc.user_id is null or p_bucket is null or p_bucket not between 1 and 8 then return null; end if;
  select jsonb_build_object(
    'total', count(*),
    'rows', coalesce(jsonb_agg(jsonb_build_object('date', to_char(x.doc_date, 'YYYY-MM-DD'), 'docType', x.doc_type, 'docNum', x.doc_num,
              'clientID', x.client_id, 'clientName', x.client_name, 'total', round(x.total, 2), 'lines', x.n_lines)
              order by x.doc_date desc, x.total desc), '[]'::jsonb))
  into res
  from (select * from deals_docs(p_company, acc.hidden_years) d
        where deal_range_bucket(d.total) = p_bucket and deal_in_period(d.doc_date, p_period)
        order by d.doc_date desc, d.total desc limit 3000) x;
  return res;
end;
$function$;
revoke all on function public.get_deals_detail(text, int, text, uuid) from public, anon;
grant execute on function public.get_deals_detail(text, int, text, uuid) to authenticated;
