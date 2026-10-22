-- Daily stock history before the first real reading (inventory_daily starts 2026-10-13).
--
-- stock_daily holds one closing quantity per company, item and day:
--   * real days (from the first reading on): copied from inventory_daily (estimated = false)
--   * earlier days: rebuilt BACKWARD from the first reading (estimated = true):
--       stock at the end of day d-1 = stock at the end of day d - stock in on d + stock out on d
--     stock in  = imports (B8) and local purchases (76) from stock_moves (rep895 / rep896), signed
--     stock out = net sales: invoice and delivery-note lines (rep891*) minus returns (855 and negative cash lines)
--   Orders (722/721/720) never move stock. A rebuilt value below zero is clamped to zero and flagged `clamped`.
-- stock_daily_check() replays the same arithmetic FORWARD from the first reading and compares it with the real
-- readings that followed, so the accuracy of the method is measured, not assumed.
-- Only companies with a stock file (pupik, mt) have readings; gold and grow have none, so nothing is rebuilt there.

create table if not exists public.stock_daily (
  company    text not null,
  sku        text not null,
  day        date not null,
  close_qty  numeric not null,
  estimated  boolean not null,
  clamped    boolean not null default false,
  primary key (company, sku, day)
);
create index if not exists stock_daily_company_day on public.stock_daily (company, day);

alter table public.stock_daily enable row level security;
drop policy if exists stock_daily_read on public.stock_daily;
create policy stock_daily_read on public.stock_daily
  for select to authenticated
  using (public.is_admin_or_above() or company in (
    select unnest(allowed_companies) from public.user_profiles where id = auth.uid()));

-- Net stock change per item and day (in minus out) over [p_from, p_to].
create or replace function public.stock_net_change(p_company text, p_from date, p_to date)
returns table (sku text, day date, net numeric)
language sql
stable
set search_path to 'public'
as $function$
  select u.sku, u.day, sum(u.qty) as net
  from (
    select m.item_sku as sku, m.move_date as day, m.qty
    from stock_moves m
    where m.company = p_company and m.move_date between p_from and p_to
    union all
    select s.item_sku, s.line_date,
           -(case when s.line_source = '855' or coalesce(s.cash, 0) < 0 then -abs(s.qty) else s.qty end)
    from sales_lines s
    where s.company = p_company and s.line_date between p_from and p_to
      and s.item_sku is not null and s.qty is not null
      and (s.line_source = '855' or s.line_source like 'rep891%')
  ) u
  group by u.sku, u.day;
$function$;

create or replace function public.rebuild_stock_daily(p_company text, p_from date default date '2026-01-01')
returns integer
language plpgsql
security definer
set search_path to 'public'
set statement_timeout to '300s'
as $function$
declare
  d0 date;
  n integer;
begin
  select min(day) into d0 from inventory_daily where company = p_company;
  if d0 is null then return 0; end if;

  delete from stock_daily where company = p_company;

  -- real days
  insert into stock_daily (company, sku, day, close_qty, estimated)
  select company, sku, day, close_qty, false
  from inventory_daily
  where company = p_company and close_qty is not null;

  -- rebuilt days before the first reading
  with anchor as (
    select sku, open_qty as qty from inventory_daily where company = p_company and day = d0
  ),
  net as (
    select sku, day, net from stock_net_change(p_company, p_from, d0 - 1)
  ),
  skus as (
    select sku from anchor
    union
    select sku from net
  ),
  grid as (
    select k.sku, g.day::date as day
    from skus k cross join generate_series(p_from, d0 - 1, interval '1 day') g(day)
  ),
  calc as (
    select g.sku, g.day,
           coalesce(a.qty, 0)
             - coalesce(sum(coalesce(n.net, 0)) over (
                 partition by g.sku order by g.day
                 rows between 1 following and unbounded following), 0) as raw_qty
    from grid g
    left join anchor a on a.sku = g.sku
    left join net n on n.sku = g.sku and n.day = g.day
  )
  insert into stock_daily (company, sku, day, close_qty, estimated, clamped)
  select p_company, sku, day, greatest(raw_qty, 0), true, raw_qty < 0
  from calc
  where raw_qty <> 0 or sku in (select sku from anchor);

  get diagnostics n = row_count;
  return n;
end;
$function$;
revoke all on function public.rebuild_stock_daily(text, date) from public, anon, authenticated;

-- How well does the method work? Replay forward from the first reading and compare with the real closings.
create or replace function public.stock_daily_check(p_company text)
returns table (items bigint, day_item_pairs bigint, exact_pairs bigint, within_5pct bigint, mean_abs_error numeric, median_abs_error numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare d0 date; d1 date;
begin
  select min(day), max(day) into d0, d1 from inventory_daily where company = p_company;
  if d0 is null or d1 = d0 then return; end if;
  return query
  with start as (select sku, open_qty as qty from inventory_daily where company = p_company and day = d0),
  net as (select sku, day, net from stock_net_change(p_company, d0, d1)),
  days as (select g.day::date as day from generate_series(d0, d1, interval '1 day') g(day)),
  grid as (select s.sku, d.day, s.qty as start_qty from start s cross join days d),
  est as (
    select g.sku, g.day,
           g.start_qty + sum(coalesce(n.net, 0)) over (partition by g.sku order by g.day) as est_qty
    from grid g left join net n on n.sku = g.sku and n.day = g.day
  ),
  cmp as (
    select e.sku, e.day, greatest(e.est_qty, 0) as est_qty, r.close_qty as real_qty
    from est e join inventory_daily r on r.company = p_company and r.sku = e.sku and r.day = e.day
    where e.day > d0 and r.close_qty is not null
  )
  select count(distinct sku), count(*),
         count(*) filter (where abs(est_qty - real_qty) < 0.5),
         count(*) filter (where abs(est_qty - real_qty) <= greatest(0.05 * real_qty, 0.5)),
         round(avg(abs(est_qty - real_qty)), 2),
         round((percentile_cont(0.5) within group (order by abs(est_qty - real_qty)))::numeric, 2)
  from cmp;
end;
$function$;
revoke all on function public.stock_daily_check(text) from public, anon, authenticated;
