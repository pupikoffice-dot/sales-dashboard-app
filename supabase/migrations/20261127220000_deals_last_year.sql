-- Deals per Range: last-year comparison (same period one year back) and a monthly trend, current year vs previous year.
-- The invoice window grows from 13 to 25 months so every comparison period is covered.
create or replace function public.deals_docs(p_company text, p_hidden int[])
returns table(doc_type text, doc_num text, doc_date date, client_id text, client_name text, total numeric, n_lines int)
language sql stable security definer set search_path to 'public'
as $$
  select s.doc_type, s.doc_num, max(s.line_date) as doc_date, max(s.client_id) as client_id, max(s.client_name) as client_name,
         sum(s.cash) as total, count(*)::int as n_lines
  from sales_lines s
  where s.company = p_company and s.line_source like 'rep891%'
    and s.doc_type between '11' and '19' and s.doc_num is not null
    and s.line_date >= (date_trunc('month', (now() at time zone 'Asia/Jerusalem')::date) - interval '25 months')::date
    and s.year <> all(coalesce(p_hidden, '{}'::int[]))
    and not (p_company = 'pupik' and s.client_id = '2100513')
  group by s.doc_type, s.doc_num
  having sum(s.cash) > 0;
$$;
revoke all on function public.deals_docs(text, int[]) from public, anon, authenticated;

-- keys: month, quarter, d90, d365, m:YYYY-MM, and the same period one year earlier: month_py, quarter_py, d90_py, d365_py
create or replace function public.deal_in_period(p_date date, p_key text)
returns boolean language sql stable
as $$
  with t as (select (now() at time zone 'Asia/Jerusalem')::date as today),
       l as (select today, (today - interval '1 year')::date as ly from t)
  select case
    when p_key = 'month' then p_date >= date_trunc('month', l.today)::date and p_date <= l.today
    when p_key = 'quarter' then p_date >= date_trunc('quarter', l.today)::date and p_date <= l.today
    when p_key = 'd90' then p_date > l.today - 90 and p_date <= l.today
    when p_key = 'd365' then p_date > l.today - 365 and p_date <= l.today
    when p_key = 'month_py' then p_date >= date_trunc('month', l.ly)::date and p_date <= l.ly
    when p_key = 'quarter_py' then p_date >= date_trunc('quarter', l.ly)::date and p_date <= l.ly
    when p_key = 'd90_py' then p_date > l.ly - 90 and p_date <= l.ly
    when p_key = 'd365_py' then p_date > l.ly - 365 and p_date <= l.ly
    when p_key like 'm:%' then to_char(p_date, 'YYYY-MM') = substr(p_key, 3)
    else false end
  from l;
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
  keys := array['month', 'quarter', 'd90', 'd365', 'month_py', 'quarter_py', 'd90_py', 'd365_py']
          || (select array_agg('m:' || m order by m desc) from unnest(months) m);
  with d as (select * from deals_docs(p_company, acc.hidden_years)),
  c as (
    select deal_range_bucket(d.total) as bucket, k as key, count(*) as n
    from d cross join unnest(keys) k
    where deal_in_period(d.doc_date, k)
    group by 1, 2
  ),
  tr as (
    select deal_range_bucket(d.total) as bucket, to_char(d.doc_date, 'YYYY-MM') as ym, count(*) as n
    from d
    where d.doc_date >= make_date(extract(year from today)::int - 1, 1, 1) and d.doc_date <= today
    group by 1, 2
  )
  select jsonb_build_object(
    'asOf', today,
    'months', (select jsonb_agg(m order by m desc) from unnest(months) m),
    'counts', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'key', key, 'n', n)) from c), '[]'::jsonb),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'ym', ym, 'n', n)) from tr), '[]'::jsonb))
  into res;
  return res;
end;
$function$;
revoke all on function public.get_deals_per_range(text, uuid) from public, anon;
grant execute on function public.get_deals_per_range(text, uuid) to authenticated;
