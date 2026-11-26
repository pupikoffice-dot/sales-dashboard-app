-- Order recommendation: sales rate measured only on days the item could actually sell.
--
-- Owner's rule (2026-11-26): an item cannot sell when it is out of stock, so dividing a year's sales by the whole year
-- understates items that were out of stock part of the year, and new items. The rate is now
--     units sold on in-stock working days / number of in-stock working days
-- over the last 12 months (365 days up to yesterday).
--
--   working day   Sunday to Thursday (no sales on Friday and Saturday). Holidays are not excluded yet.
--   in stock      the day's OPENING stock (= previous day's closing stock in stock_daily) is above the threshold:
--                 10 pieces, or one working week of the item's own sales when that is smaller (slow items), and always above 0.
--                 One working week = 5 x units sold in the window / working days from the item's first sale in the window.
--   early arrival the 7 days before each B8 import date also count (goods reach the warehouse or waiting orders before
--                 the B8 is posted; owner decision).
--   stock source  stock_daily: real 000 readings from 14 Oct 2026, rebuilt backward before that. A day with no row is 0;
--                 a day before the first stock_daily day of the company is unknown and never counts. Rebuilt days before
--                 the item's first sale or first recorded arrival (whichever is earlier) do not count either (not launched).
--                 Rebuilt days where the backward rebuild went below zero (stock_daily.clamped) are unknown too: a
--                 movement is missing from our files there, so the real stock that day is not known.
--   sales         invoice and delivery-note quantities (rep891*). Sold pieces count only on in-stock days, reduced by
--                 the item's return share over the window (returns / pieces sold, all days): a return usually comes
--                 back after the shelf is empty, and it belongs to whichever sale it reverses, so it is spread in
--                 proportion instead of being dropped or charged in full to the counted days.
--   big orders    capped like the old engine: one client's month of an item counts at most 5 x the item's median
--                 client-month (last 24 full months, min 12 pieces); intergroup clients are not capped.
--
-- Fallbacks when an item has fewer than 14 in-stock working days:
--   'b8'          from the last B8 import that had no sales in the 14 days before it, to the last sale
--                 (or to yesterday if stock is still above the threshold): units sold / working days.
--   'first_sale'  same, from the first sale in the window.
--   null          not enough evidence: order_engine keeps its 12-month rate.
-- Result rate_wd is per WORKING day; order_engine converts it to per calendar day with x 5/7, so all its month and lead-time
-- maths stay unchanged.

create or replace function public.item_sellable_rate(p_company text, p_today date default current_date)
returns table (sku text, basis text, sell_days integer, sell_qty numeric, rate_wd numeric, threshold numeric,
               unknown_days integer, low_days integer, early_days integer)
language sql
stable
security definer
set search_path to 'public'
set statement_timeout to '60s'
set enable_nestloop to 'on'
as $function$
  with par as (
    select (p_today - 365) as w0, (p_today - 1) as w1,
           (select min(d.day) from stock_daily d where d.company = p_company) as sd0
  ),
  cal as (   -- working-day counter: wd(d1) - wd(d0 - 1) = working days from d0 to d1
    select g.d::date as day, count(*) filter (where extract(dow from g.d) <= 4) over (order by g.d) as wd
      from par, generate_series(par.w0 - 30, par.w1, interval '1 day') g(d)
  ),
  lines as (
    select s.item_sku as sku, s.client_id, s.line_date as day, date_trunc('month', s.line_date)::date as mth, s.qty
      from sales_lines s, par
     where s.company = p_company and s.line_source like 'rep891%' and s.item_sku is not null and s.qty is not null
       and s.line_date between par.w0 and par.w1
  ),
  med as (   -- the item's usual client-month (same as order_engine's outlier trim)
    select f.item_sku as sku, (percentile_cont(0.5) within group (order by f.qty_sold))::numeric as p50
      from purchase_facts f
     where f.company = p_company and f.qty_sold > 0 and not f.intergroup and f.item_sku is not null
       and make_date(f.year, f.month, 1) >= (date_trunc('month', p_today) - interval '24 months')::date
       and make_date(f.year, f.month, 1) < date_trunc('month', p_today)::date
     group by f.item_sku
  ),
  ig as (
    select distinct f.client_id from purchase_facts f where f.company = p_company and f.intergroup
  ),
  cm as (   -- share of each client-month that counts after the cap
    select l.sku, l.client_id, l.mth,
           case when l.client_id in (select client_id from ig) then 1
                else least(1, greatest(5 * coalesce(max(m.p50), sum(l.qty)), 12) / sum(l.qty)) end as k
      from lines l left join med m on m.sku = l.sku
     where l.qty > 0
     group by l.sku, l.client_id, l.mth
  ),
  sales as (
    select l.sku, l.day,
           sum(case when l.qty > 0 then l.qty * coalesce(c.k, 1) else l.qty end) as q,
           sum(l.qty * coalesce(c.k, 1)) filter (where l.qty > 0) as qpos,
           sum(l.qty) filter (where l.qty < 0) as qneg
      from lines l
      left join cm c on c.sku = l.sku and c.client_id = l.client_id and c.mth = l.mth and l.qty > 0
     group by l.sku, l.day
  ),
  items as (
    select sa.sku, sum(sa.q) as q, min(sa.day) filter (where sa.q > 0) as first_sale, max(sa.day) filter (where sa.q > 0) as last_sale
      from sales sa group by sa.sku having sum(sa.q) > 0
  ),
  launch as (
    select i.sku,
           least(i.first_sale,
                 (select min(m.move_date) from stock_moves m where m.company = p_company and m.item_sku = i.sku and m.qty > 0)) as launch_day
      from items i
  ),
  wk as (   -- one working week of sales, from the first sale in the window to yesterday
    select i.sku,
           5 * i.q / greatest(1, c1.wd - c0.wd) as week_qty
      from items i, par
      join cal c1 on c1.day = par.w1
      join cal c0 on true
     where c0.day = i.first_sale - 1
  ),
  thr as (
    select w.sku, least(10, w.week_qty) as t from wk w
  ),
  early as (
    select distinct m.item_sku as sku, (m.move_date - g.k) as day
      from stock_moves m cross join generate_series(1, 7) g(k), par
     where m.company = p_company and m.move_kind = 'import' and m.qty > 0
       and m.move_date - g.k between par.w0 and par.w1
       and m.item_sku in (select i.sku from items i)
  ),
  grid as (
    select i.sku, g.d::date as day
      from items i, par cross join generate_series(par.w0, par.w1, interval '1 day') g(d)
  ),
  daily as (
    select g.sku, g.day,
           extract(dow from g.day) <= 4 as workday,
           case when par.sd0 is null or g.day - 1 < par.sd0 then null else coalesce(d.close_qty, 0) end as open_qty,
           coalesce(not d.estimated, g.day - 1 >= (select min(r.day) from inventory_daily r where r.company = p_company)) as real_day,
           coalesce(d.clamped, false) as clamped,
           coalesce(sa.q, 0) as q, coalesce(sa.qpos, 0) as qpos, coalesce(sa.qneg, 0) as qneg,
           (e.day is not null) as early
      from grid g
      cross join par
      left join stock_daily d on d.company = p_company and d.sku = g.sku and d.day = g.day - 1
      left join sales sa on sa.sku = g.sku and sa.day = g.day
      left join early e on e.sku = g.sku and e.day = g.day
  ),
  marked as (
    select dl.*, t.t,
           case
             when dl.early then 'in'
             when dl.open_qty is null then 'unknown'
             when not dl.real_day and dl.day < l.launch_day then 'unknown'
             when not dl.real_day and dl.clamped then 'unknown'   -- the rebuild went below zero: real stock not known
             when dl.open_qty > t.t and dl.open_qty > 0 then 'in'
             else 'low' end as state
      from daily dl join thr t on t.sku = dl.sku join launch l on l.sku = dl.sku
  ),
  main as (
    select m.sku, max(m.t) as t,
           count(*) filter (where m.workday and m.state = 'in')::int as sell_days,
           coalesce(sum(m.qpos) filter (where m.state = 'in'), 0)
             * greatest(0, 1 + coalesce(sum(m.qneg), 0) / nullif(sum(m.qpos), 0)) as sell_qty,
           count(*) filter (where m.workday and m.state = 'unknown')::int as unknown_days,
           count(*) filter (where m.workday and m.state = 'low')::int as low_days,
           count(*) filter (where m.workday and m.early)::int as early_days
      from marked m group by m.sku
  ),
  cur as (   -- is the item still in stock at the end of the window?
    select m.sku, bool_or(m.day = (select w1 from par) and m.state = 'in') as still_in from marked m group by m.sku
  ),
  b8start as (   -- last B8 import with no sales in the 14 days before it
    select distinct on (x.sku) x.sku, x.d
      from (select mv.item_sku as sku, mv.move_date as d, count(sa.day) as before_sales
              from stock_moves mv
              cross join par
              left join sales sa on sa.sku = mv.item_sku and sa.q > 0 and sa.day between mv.move_date - 14 and mv.move_date - 1
             where mv.company = p_company and mv.move_kind = 'import' and mv.qty > 0 and mv.move_date between par.w0 and par.w1
             group by 1, 2) x
     where x.before_sales = 0
     order by x.sku, x.d desc
  ),
  fb as (
    select i.sku, k.kind, k.d0,
           case when c.still_in then (select w1 from par) else i.last_sale end as d1
      from items i
      join cur c on c.sku = i.sku
      left join b8start b on b.sku = i.sku
      cross join lateral (values ('b8', b.d), ('first_sale', i.first_sale)) k(kind, d0)
     where k.d0 is not null
  ),
  fbr as (
    select f.sku, f.kind, (c1.wd - c0.wd)::int as wd,
           coalesce(sum(sa.qpos) filter (where sa.day between f.d0 and f.d1), 0)
             * greatest(0, 1 + coalesce(sum(sa.qneg), 0) / nullif(sum(sa.qpos), 0)) as q
      from fb f
      join cal c1 on c1.day = f.d1
      join cal c0 on c0.day = f.d0 - 1
      left join sales sa on sa.sku = f.sku
     where f.d1 >= f.d0
     group by f.sku, f.kind, c1.wd, c0.wd
  )
  select mn.sku,
         case when mn.sell_days >= 14 then 'stock'
              when b.wd >= 5 then 'b8'
              when fs.wd >= 5 then 'first_sale' end as basis,
         case when mn.sell_days >= 14 then mn.sell_days when b.wd >= 5 then b.wd when fs.wd >= 5 then fs.wd end,
         case when mn.sell_days >= 14 then mn.sell_qty when b.wd >= 5 then b.q when fs.wd >= 5 then fs.q end,
         round(case when mn.sell_days >= 14 then mn.sell_qty / mn.sell_days
                    when b.wd >= 5 then b.q / b.wd
                    when fs.wd >= 5 then fs.q / fs.wd end, 4) as rate_wd,
         round(mn.t, 1), mn.unknown_days, mn.low_days, mn.early_days
    from main mn
    left join fbr b on b.sku = mn.sku and b.kind = 'b8'
    left join fbr fs on fs.sku = mn.sku and fs.kind = 'first_sale';
$function$;
revoke all on function public.item_sellable_rate(text, date) from public, anon, authenticated;
