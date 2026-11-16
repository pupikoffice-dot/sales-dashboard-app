-- R&D "Order recommendation" + "Import stock cover" (Phase 1: sales + current stock only; B2/B6/B8 feeds come in Phase 2).
-- One calculation engine (order_engine) feeds both pages. Pages are grants in dashboard_user_access.modules:
--   rnd_order_reco, rnd_import_cover. Reads and writes go through gated definer RPCs (rnd_gate also refuses sales-agent users).
--
-- Method (per item, per company; tunable constants are at the top of order_engine):
--   rate12   = sold qty in the last 12 COMPLETE months / days            (sales per day)
--   trend    = rate12 / rate of the 12 months before it, clamped 0.5..2   (1 when the item has under ~2 years of history)
--   forecast = for every future day: the same calendar month last year, per day, x trend; floored at 25% of rate12;
--              items under ~13 months old use rate12 flat. One client's one-month quantity is capped (outlier trim)
--              at 5x the item's median client-month (min 12), intergroup clients are not capped.
--   order qty = forecast demand over [arrival, arrival + cover] + safety - stock expected at arrival - goods on the way (Phase 2: 0)
--   listed when stock is expected to reach the safety level within lead + 0.5 months (4 months when no lead time is set).

create table if not exists public.order_supplier_settings (
  company        text not null,
  supplier_name  text not null,
  lead_months    numeric,                 -- null = not set (then the 4-month default horizon is used)
  cover_months   numeric not null default 4,
  safety_months  numeric not null default 0.5,
  internal       boolean not null default false,   -- supplier inside the group (e.g. 'Pupik' seen from mt)
  payment_terms  text,                     -- free text for now; Phase 3 payment simulations
  payment_days   integer,
  payment_notes  text,
  updated_by     uuid,
  updated_at     timestamptz not null default now(),
  primary key (company, supplier_name)
);
alter table public.order_supplier_settings enable row level security;

create table if not exists public.order_item_hidden (
  company    text not null,
  sku        text not null,
  hidden_by  uuid,
  hidden_at  timestamptz not null default now(),
  primary key (company, sku)
);
alter table public.order_item_hidden enable row level security;

-- Internal suppliers get a short lead time by default (days, not months); everything else starts unset.
insert into public.order_supplier_settings (company, supplier_name, lead_months, cover_months, safety_months, internal)
select c.company, 'Pupik', 0.25, 2, 0.25, true
  from (values ('mt'), ('gold'), ('grow')) c(company)
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------
-- Engine. Not callable by clients (revoked); the RPCs below wrap it.
-- ---------------------------------------------------------------------------------------------
create or replace function public.order_engine(p_company text, p_today date default current_date, p_include_hidden boolean default false)
returns table (
  sku text, item_name text, supplier text, internal boolean,
  stock numeric, rate12 numeric, rate_prior12 numeric, trend numeric, forecast_rate numeric,
  sold_months12 integer, sold_qty12 numeric, last_sold date, first_sold date, ly_ok boolean,
  demand_lead numeric, stock_at_arrival numeric, demand_cover numeric, safety_qty numeric,
  pipeline_qty numeric, order_qty numeric, run_out date, order_by date,
  months_left numeric, oos boolean, status text,
  lead_months numeric, cover_months numeric, safety_months numeric, alert_months numeric, hidden boolean)
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
           ls.last_sold, ls.first_sold
      from cand c
      left join inventory i on i.company = p_company and i.sku = c.sku
      left join names n on n.sku = c.sku
      left join lastsale ls on ls.sku = c.sku
      left join supplier_prefix sp on sp.prefix = upper(split_part(c.sku, '-', 1))
  ),
  withset as (
    select b.*,
           coalesce(st.internal, false) as internal,
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
           (select (greatest(p_today, c.fm_start) + (case when c.rate > 0 then ((w.stock - w.safety_m * c_dim * w.rate12 * w.trend) - (c.cum_end - c.rate * c.days_in)) / c.rate else 0 end)::int)
              from cum c
             where c.sku = w.sku and c.days_in > 0 and c.cum_end >= (w.stock - w.safety_m * c_dim * w.rate12 * w.trend)
             order by c.fm_start limit 1) as run_out
      from (select ws.sku, ws.rate12, ws.trend, ws.safety_m, ws.stock from withset ws) w
  )
  select w.sku, w.item_name, w.supplier, w.internal,
         w.stock, w.rate12, w.rate_prior12, w.trend, w.rate12 * w.trend,
         w.months12, w.q12, w.last_sold, w.first_sold, w.ly_ok,
         round(d.demand_lead, 1),
         greatest(0, round(w.stock - d.demand_lead, 1)),
         round(d.demand_cover, 1),
         round(w.safety_m * c_dim * w.rate12 * w.trend, 1),
         0::numeric,
         greatest(0, ceil(d.demand_cover + w.safety_m * c_dim * w.rate12 * w.trend - greatest(0, w.stock - d.demand_lead) - 0)),
         ro.run_out,
         case when ro.run_out is null then null else ro.run_out - (coalesce(w.lead_m, 0) * c_dim)::int end,
         case when w.rate12 > 0 then round(w.stock / (w.rate12 * c_dim), 1) end,
         (w.stock <= 0),
         case
           when w.stock <= 0 and w.months12 >= 3 then 'out'
           when ro.run_out is null then 'ok'
           when ro.run_out - (coalesce(w.lead_m, 0) * c_dim)::int < p_today then 'late'
           when ro.run_out <= p_today + ((coalesce(w.lead_m + c_extra, c_default)) * c_dim)::int then 'order'
           else 'ok' end,
         w.lead_m, w.cover_m, w.safety_m, coalesce(w.lead_m + c_extra, c_default), w.hidden
    from withset w
    join dem d on d.sku = w.sku
    left join runout ro on ro.sku = w.sku
   where (w.stock > 0 or w.months12 >= 3)    -- zero-stock items only when sold in 3+ different months of the last 12
     and (p_include_hidden or not w.hidden);
end;
$function$;
revoke all on function public.order_engine(text, date, boolean) from public, anon, authenticated;
grant execute on function public.order_engine(text, date, boolean) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Order recommendation page: items that need an order (late / order / out), flat; the page groups by supplier.
-- ---------------------------------------------------------------------------------------------
create or replace function public.get_order_recommendation(p_company text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '60s'
as $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := rnd_gate(p_company, p_as, 'rnd_order_reco');
  if acc.user_id is null then return null; end if;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.supplier, e.order_by nulls last, e.sku), '[]'::jsonb) into res
    from order_engine(p_company) e
   where e.status in ('late', 'order', 'out') and e.order_qty > 0;
  return res;
end;
$function$;
revoke all on function public.get_order_recommendation(text, uuid) from public, anon;
grant execute on function public.get_order_recommendation(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Import stock cover page: every item that sold in the last 12 months, per supplier (hidden ones only on request).
-- ---------------------------------------------------------------------------------------------
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
           'hidden', e.hidden) order by e.supplier, e.sku), '[]'::jsonb) into res
    from order_engine(p_company, current_date, true) e
   where p_show_hidden or not e.hidden;
  return res;
end;
$function$;
revoke all on function public.get_import_cover(text, boolean, uuid) from public, anon;
grant execute on function public.get_import_cover(text, boolean, uuid) to authenticated;

-- Hide / un-hide an item (shared, per company; nothing is deleted).
create or replace function public.set_order_item_hidden(p_company text, p_sku text, p_hidden boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare acc dashboard_user_access;
begin
  acc := rnd_gate(p_company, null, 'rnd_import_cover');
  if acc.user_id is null then return false; end if;
  if p_hidden then
    insert into order_item_hidden (company, sku, hidden_by) values (p_company, p_sku, auth.uid()) on conflict do nothing;
  else
    delete from order_item_hidden where company = p_company and sku = p_sku;
  end if;
  return true;
end;
$function$;
revoke all on function public.set_order_item_hidden(text, text, boolean) from public, anon;
grant execute on function public.set_order_item_hidden(text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Supplier settings table (lead time etc.): every supplier that has an item in the engine, plus saved rows.
-- ---------------------------------------------------------------------------------------------
create or replace function public.get_order_settings(p_company text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '60s'
as $function$
declare acc dashboard_user_access;
begin
  acc := rnd_gate(p_company, p_as, 'rnd_order_reco');
  if acc.user_id is null then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'supplier_name', s.supplier_name, 'items', s.items,
             'lead_months', st.lead_months, 'cover_months', coalesce(st.cover_months, 4),
             'safety_months', coalesce(st.safety_months, 0.5), 'internal', coalesce(st.internal, false),
             'payment_terms', st.payment_terms, 'payment_days', st.payment_days, 'payment_notes', st.payment_notes)
           order by s.supplier_name)
      from (select e.supplier as supplier_name, count(*) as items from order_engine(p_company, current_date, true) e group by e.supplier
            union
            select o.supplier_name, 0 from order_supplier_settings o where o.company = p_company
              and o.supplier_name not in (select e2.supplier from order_engine(p_company, current_date, true) e2)) s
      left join order_supplier_settings st on st.company = p_company and st.supplier_name = s.supplier_name
  ), '[]'::jsonb);
end;
$function$;
revoke all on function public.get_order_settings(text, uuid) from public, anon;
grant execute on function public.get_order_settings(text, uuid) to authenticated;

create or replace function public.set_order_setting(
  p_company text, p_supplier text, p_lead_months numeric, p_cover_months numeric, p_safety_months numeric,
  p_internal boolean, p_payment_terms text, p_payment_days integer, p_payment_notes text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare acc dashboard_user_access;
begin
  acc := rnd_gate(p_company, null, 'rnd_order_reco');
  if acc.user_id is null or coalesce(trim(p_supplier), '') = '' then return false; end if;
  if (p_lead_months is not null and (p_lead_months < 0 or p_lead_months > 24))
     or coalesce(p_cover_months, 4) not between 0.5 and 24 or coalesce(p_safety_months, 0.5) not between 0 and 12 then
    raise exception 'setting out of range';
  end if;
  insert into order_supplier_settings (company, supplier_name, lead_months, cover_months, safety_months, internal,
                                       payment_terms, payment_days, payment_notes, updated_by, updated_at)
  values (p_company, p_supplier, p_lead_months, coalesce(p_cover_months, 4), coalesce(p_safety_months, 0.5), coalesce(p_internal, false),
          nullif(trim(p_payment_terms), ''), p_payment_days, nullif(trim(p_payment_notes), ''), auth.uid(), now())
  on conflict (company, supplier_name) do update set
    lead_months = excluded.lead_months, cover_months = excluded.cover_months, safety_months = excluded.safety_months,
    internal = excluded.internal, payment_terms = excluded.payment_terms, payment_days = excluded.payment_days,
    payment_notes = excluded.payment_notes, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  return true;
end;
$function$;
revoke all on function public.set_order_setting(text, text, numeric, numeric, numeric, boolean, text, integer, text) from public, anon;
grant execute on function public.set_order_setting(text, text, numeric, numeric, numeric, boolean, text, integer, text) to authenticated;
