-- Order recommendation, phase 2 (2026-11-16): goods already ordered (B2, report 063) and invoiced on the way (B6, report 064)
-- count as stock that is coming; the last B8 import (report 896, table stock_moves) gives a second sales speed as a cross-check.
-- B2 has an asked delivery date but no firm one: it is subtracted in full from the need (an order of 366 pieces swallows a need of 188;
-- a need of 366 with 144 on order leaves 222). B6 arrives about 38 days after the invoice date (never earlier than 3 days from today).

create table if not exists public.supplier_pipeline (
  id          bigint generated always as identity primary key,
  company     text not null,
  kind        text not null check (kind in ('B2', 'B6')),
  doc_num     text,
  sku         text not null,
  supplier_id text,
  alt_sku     text,
  item_name   text,
  due_date    date,            -- B2: asked delivery date; B6: invoice / ETD date
  qty         numeric not null,  -- balance still to come
  fob_price   numeric,
  currency    text,
  total       numeric,
  source_file text not null,
  loaded_at   timestamptz not null default now()
);
create index if not exists supplier_pipeline_company_sku on public.supplier_pipeline (company, sku);
alter table public.supplier_pipeline enable row level security;   -- no policies: only the sync (service role) and definer functions touch it

drop function if exists public.order_engine(text, date, boolean);
create function public.order_engine(p_company text, p_today date default current_date, p_include_hidden boolean default false)
returns table (
  sku text, item_name text, supplier text, internal boolean,
  stock numeric, rate12 numeric, rate_prior12 numeric, trend numeric, forecast_rate numeric,
  sold_months12 integer, sold_qty12 numeric, last_sold date, first_sold date, ly_ok boolean,
  demand_lead numeric, stock_at_arrival numeric, demand_cover numeric, safety_qty numeric,
  pipeline_qty numeric, order_qty numeric, run_out date, order_by date,
  months_left numeric, oos boolean, status text,
  lead_months numeric, cover_months numeric, safety_months numeric, alert_months numeric, hidden boolean,
  b2_qty numeric, b6_qty numeric, b2_due date, b6_arrival date,
  last_import_date date, last_import_qty numeric, b8_rate numeric, b8_days integer, b8_flag boolean)
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '60s'
as $function$
#variable_conflict use_column
declare
  m0 date := date_trunc('month', p_today)::date;
  c_floor    constant numeric := 0.25;   -- forecast never below 25% of the 12-month rate
  c_capmult  constant numeric := 5;      -- outlier trim: client-month cap = 5 x item median ...
  c_capmin   constant numeric := 12;     -- ... but at least 12 pcs
  c_extra    constant numeric := 0.5;    -- months of reaction time on top of the lead time
  c_default  constant numeric := 4;      -- horizon when a supplier has no lead time yet
  c_dim      constant numeric := 30.4375;
begin
  return query
  with pf as (
    select f.item_sku as sku, make_date(f.year, f.month, 1) as mth, f.intergroup, f.qty_sold as q
      from purchase_facts f
     where f.company = p_company and f.qty_sold > 0 and f.item_sku is not null
       and make_date(f.year, f.month, 1) >= (m0 - interval '36 months')::date
       and make_date(f.year, f.month, 1) < m0
  ),
  med as (
    select p.sku, (percentile_cont(0.5) within group (order by p.q))::numeric as p50
      from pf p where not p.intergroup and p.mth >= (m0 - interval '24 months')::date group by p.sku
  ),
  monthly as (
    select p.sku, p.mth, sum(case when p.intergroup then p.q else least(p.q, greatest(c_capmult * coalesce(m.p50, p.q), c_capmin)) end) as q
      from pf p left join med m on m.sku = p.sku group by p.sku, p.mth
  ),
  agg as (
    select mo.sku,
           sum(mo.q) filter (where mo.mth >= (m0 - interval '12 months')::date) as q12,
           sum(mo.q) filter (where mo.mth <  (m0 - interval '12 months')::date and mo.mth >= (m0 - interval '24 months')::date) as qp12,
           count(*) filter (where mo.mth >= (m0 - interval '12 months')::date) as months12,
           min(mo.mth) as first_m
      from monthly mo group by mo.sku
  ),
  cand as (   -- an item is a candidate when it sold in the last 12 complete months (this is also the "dead item" rule)
    select a.*, (m0 - (m0 - interval '12 months')::date)::numeric as d12, (m0 - interval '12 months')::date - (m0 - interval '24 months')::date as dp12
      from agg a where coalesce(a.q12, 0) > 0
  ),
  lastsale as (
    select s.item_sku as sku, max(s.line_date) as last_sold, min(s.line_date) as first_sold
      from sales_lines s
     where s.company = p_company and s.line_date >= (m0 - interval '36 months')::date
       and (s.line_source in ('855') or s.line_source like 'rep891%') and s.qty > 0 and s.item_sku in (select c.sku from cand c)
     group by s.item_sku
  ),
  names as (
    select distinct on (s.item_sku) s.item_sku as sku, s.item_name
      from sales_lines s
     where s.company = p_company and s.line_date >= (m0 - interval '14 months')::date and s.item_name is not null
       and s.item_sku in (select c.sku from cand c)
     order by s.item_sku, s.line_date desc
  ),
  pipe as (   -- goods ordered (B2, no firm date) and invoiced on the way (B6): they count as stock that is coming
    select p.sku, coalesce(sum(p.qty) filter (where p.kind = 'B2'), 0) as b2, coalesce(sum(p.qty) filter (where p.kind = 'B6'), 0) as b6,
           min(p.due_date) filter (where p.kind = 'B2') as b2_due, min(p.due_date) filter (where p.kind = 'B6') as b6_due
      from supplier_pipeline p
     where p.company = p_company and p.qty > 0 and p.sku in (select c.sku from cand c)
     group by p.sku
  ),
  lastimp as (   -- last B8 import per item
    select distinct on (m.item_sku) m.item_sku as sku, m.move_date, m.qty
      from stock_moves m
     where m.company = p_company and m.move_kind = 'import' and m.qty > 0 and m.item_sku in (select c.sku from cand c)
     order by m.item_sku, m.move_date desc, m.id desc
  ),
  b8 as (   -- sales speed after that import: stock the day it was entered, down to about 5 pieces (counting stops there)
    select li.sku, li.move_date, li.qty,
           x.c0, x.hit_day, x.end_day, x.end_qty
      from lastimp li
      left join lateral (
        select (select d0.close_qty from stock_daily d0 where d0.company = p_company and d0.sku = li.sku and d0.day = li.move_date) as c0,
               (select min(d1.day) from stock_daily d1 where d1.company = p_company and d1.sku = li.sku and d1.day > li.move_date and d1.close_qty <= 5) as hit_day,
               (select max(d2.day) from stock_daily d2 where d2.company = p_company and d2.sku = li.sku) as end_day,
               (select d3.close_qty from stock_daily d3 where d3.company = p_company and d3.sku = li.sku order by d3.day desc limit 1) as end_qty
      ) x on true
  ),
  base as (
    select c.sku,
           coalesce(i.name, n.item_name, c.sku) as item_name,
           coalesce(sp.supplier_name, upper(split_part(c.sku, '-', 1))) as supplier,
           coalesce(i.qty_on_hand, 0)::numeric as stock,
           c.q12 / c.d12 as rate12,
           coalesce(c.qp12, 0) / nullif(c.dp12, 0) as rate_prior12,
           c.months12::int as months12, c.q12, c.first_m,
           (c.first_m <= (m0 - interval '13 months')::date) as ly_ok,
           (c.first_m <= (m0 - interval '23 months')::date) as trend_ok,
           ls.last_sold, ls.first_sold,
           coalesce(pp.b2, 0) as b2, coalesce(pp.b6, 0) as b6, pp.b2_due, pp.b6_due,
           bb.move_date as imp_date, bb.qty as imp_qty,
           case when bb.c0 is null then null
                when bb.hit_day is not null then case when bb.hit_day - bb.move_date >= 14 and bb.c0 > 5 then (bb.c0 - 5) / (bb.hit_day - bb.move_date) end
                when bb.end_day - bb.move_date >= 14 and bb.c0 > bb.end_qty then (bb.c0 - bb.end_qty) / (bb.end_day - bb.move_date) end as b8_rate,
           case when bb.hit_day is not null then bb.hit_day - bb.move_date else bb.end_day - bb.move_date end as b8_days
      from cand c
      left join inventory i on i.company = p_company and i.sku = c.sku
      left join names n on n.sku = c.sku
      left join lastsale ls on ls.sku = c.sku
      left join pipe pp on pp.sku = c.sku
      left join b8 bb on bb.sku = c.sku
      left join supplier_prefix sp on sp.prefix = upper(split_part(c.sku, '-', 1))
  ),
  withset as (
    select b.*,
           coalesce(st.internal, false) as internal,
           (b.stock + b.b2 + b.b6) as stock_eff,
           st.lead_months as lead_m,
           coalesce(st.cover_months, 4) as cover_m,
           coalesce(st.safety_months, 0.5) as safety_m,
           case when b.trend_ok and b.rate_prior12 > 0 then greatest(0.5, least(2, b.rate12 / b.rate_prior12)) else 1 end as trend,
           exists (select 1 from order_item_hidden h where h.company = p_company and h.sku = b.sku) as hidden
      from base b
      left join order_supplier_settings st on st.company = p_company and st.supplier_name = b.supplier
     where b.supplier <> 'Shipping'
  ),
  fm as (  -- future months, with the item's per-day forecast for each; overlap with "from today" in days
    select w.sku, g.fm_start, (g.fm_start + interval '1 month')::date as fm_end,
           greatest(w.rate12 * c_floor,
             case when w.ly_ok then coalesce(ly.q, 0) / (((g.fm_start - interval '12 months')::date + interval '1 month')::date - (g.fm_start - interval '12 months')::date) * w.trend
                  else w.rate12 * w.trend end) as rate
      from withset w
      cross join lateral (select generate_series(m0, (m0 + interval '20 months')::date, interval '1 month')::date as fm_start) g
      left join monthly ly on ly.sku = w.sku and ly.mth = (g.fm_start - interval '12 months')::date
  ),
  dem as (
    select w.sku,
           coalesce(sum(f.rate * greatest(0, least((p_today + (coalesce(w.lead_m, 0) * c_dim)::int), f.fm_end) - greatest(p_today, f.fm_start))), 0) as demand_lead,
           coalesce(sum(f.rate * greatest(0, least((p_today + ((coalesce(w.lead_m, 0) + w.cover_m) * c_dim)::int), f.fm_end) - greatest((p_today + (coalesce(w.lead_m, 0) * c_dim)::int), f.fm_start))), 0) as demand_cover
      from withset w join fm f on f.sku = w.sku
     group by w.sku
  ),
  cum as (   -- running demand by month from today, to find the day stock reaches the safety level
    select w.sku, f.fm_start, f.fm_end, f.rate,
           greatest(0, f.fm_end - greatest(p_today, f.fm_start)) as days_in,
           sum(f.rate * greatest(0, f.fm_end - greatest(p_today, f.fm_start))) over (partition by w.sku order by f.fm_start) as cum_end
      from withset w join fm f on f.sku = w.sku
  ),
  runout as (
    select w.sku,
           (select (greatest(p_today, c.fm_start) + (case when c.rate > 0 then ((w.stock_eff - w.safety_m * c_dim * w.rate12 * w.trend) - (c.cum_end - c.rate * c.days_in)) / c.rate else 0 end)::int)
              from cum c
             where c.sku = w.sku and c.days_in > 0 and c.cum_end >= (w.stock_eff - w.safety_m * c_dim * w.rate12 * w.trend)
             order by c.fm_start limit 1) as run_out
      from (select ws.sku, ws.rate12, ws.trend, ws.safety_m, ws.stock_eff from withset ws) w
  )
  select w.sku, w.item_name, w.supplier, w.internal,
         w.stock, w.rate12, w.rate_prior12, w.trend, w.rate12 * w.trend,
         w.months12, w.q12, w.last_sold, w.first_sold, w.ly_ok,
         round(d.demand_lead, 1),
         greatest(0, round(w.stock_eff - d.demand_lead, 1)),
         round(d.demand_cover, 1),
         round(w.safety_m * c_dim * w.rate12 * w.trend, 1),
         (w.b2 + w.b6),
         greatest(0, ceil(d.demand_cover + w.safety_m * c_dim * w.rate12 * w.trend - greatest(0, w.stock_eff - d.demand_lead))),
         ro.run_out,
         case when ro.run_out is null then null else ro.run_out - (coalesce(w.lead_m, 0) * c_dim)::int end,
         case when w.rate12 > 0 then round(w.stock / (w.rate12 * c_dim), 1) end,
         (w.stock <= 0),
         case
           when w.stock <= 0 and w.months12 >= 3 and w.b2 + w.b6 = 0 then 'out'
           when ro.run_out is null then 'ok'
           when ro.run_out - (coalesce(w.lead_m, 0) * c_dim)::int < p_today then 'late'
           when ro.run_out <= p_today + ((coalesce(w.lead_m + c_extra, c_default)) * c_dim)::int then 'order'
           else 'ok' end,
         w.lead_m, w.cover_m, w.safety_m, coalesce(w.lead_m + c_extra, c_default), w.hidden,
         w.b2, w.b6, w.b2_due, case when w.b6 > 0 then greatest(w.b6_due + 38, p_today + 3) end,
         w.imp_date, w.imp_qty, round(w.b8_rate, 3), w.b8_days::int,
         (w.b8_rate is not null and w.rate12 * w.trend > 0 and abs(w.b8_rate / (w.rate12 * w.trend) - 1) > 0.4)
    from withset w
    join dem d on d.sku = w.sku
    left join runout ro on ro.sku = w.sku
   where (w.stock > 0 or w.months12 >= 3)    -- zero-stock items only when sold in 3+ different months of the last 12
     and (p_include_hidden or not w.hidden);
end;
$function$;
revoke all on function public.order_engine(text, date, boolean) from public, anon, authenticated;
grant execute on function public.order_engine(text, date, boolean) to service_role;

create or replace function public.get_import_cover(p_company text, p_show_hidden boolean default false, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '60s'
as $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := rnd_gate(p_company, p_as, 'rnd_import_cover');
  if acc.user_id is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'sku', e.sku, 'item_name', e.item_name, 'supplier', e.supplier, 'internal', e.internal,
           'stock', e.stock, 'rate12', e.rate12, 'forecast_rate', e.forecast_rate,
           'sold_months12', e.sold_months12, 'sold_qty12', e.sold_qty12, 'last_sold', e.last_sold,
           'months_left', e.months_left, 'run_out', e.run_out, 'oos', e.oos, 'status', e.status,
           'hidden', e.hidden, 'b2_qty', e.b2_qty, 'b6_qty', e.b6_qty, 'b6_arrival', e.b6_arrival,
           'b8_rate', e.b8_rate, 'b8_flag', e.b8_flag) order by e.supplier, e.sku), '[]'::jsonb) into res
    from order_engine(p_company, current_date, true) e
   where p_show_hidden or not e.hidden;
  return res;
end;
$function$;
revoke all on function public.get_import_cover(text, boolean, uuid) from public, anon;
grant execute on function public.get_import_cover(text, boolean, uuid) to authenticated;
