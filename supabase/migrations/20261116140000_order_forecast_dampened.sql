-- Forecast made steadier (2026-11-16):
--   1. base rate (column rate12) = average of the 12-month rate and the last-6-complete-months rate (12-month only for items under 6 months old)
--   2. trend = 12-month rate / the 12 months before, now capped at 1.3 (was 2), and 1.00 when the year before had fewer than 10 months with sales
--      (a stock-out year would make the trend look too strong)
-- Forecast per month = base x trend. Patches order_engine in place (keeps its settings).
do $do$
declare d text;
  procedure_text text;
begin
  d := pg_get_functiondef('public.order_engine(text,date,boolean)'::regprocedure);

  if position('min(mo.mth) as first_m' in d) = 0 or position('c.q12 / c.d12 as rate12,' in d) = 0
     or position('case when b.trend_ok and b.rate_prior12 > 0 then greatest(0.5, least(2, b.rate12 / b.rate_prior12)) else 1 end as trend' in d) = 0 then
    raise exception 'order_engine layout not as expected';
  end if;

  d := replace(d, 'min(mo.mth) as first_m',
    $t$min(mo.mth) as first_m,
           sum(mo.q) filter (where mo.mth >= (m0 - interval '6 months')::date) as q6,
           count(*) filter (where mo.mth < (m0 - interval '12 months')::date and mo.mth >= (m0 - interval '24 months')::date) as mp12$t$);

  d := replace(d, 'c.q12 / c.d12 as rate12,',
    $t$case when c.first_m <= (m0 - interval '6 months')::date
                then 0.5 * c.q12 / c.d12 + 0.5 * coalesce(c.q6, 0) / (m0 - (m0 - interval '6 months')::date)
                else c.q12 / c.d12 end as rate12,
           c.q12 / c.d12 as rate_y,
           coalesce(c.mp12, 0) as mp12,$t$);

  d := replace(d, 'case when b.trend_ok and b.rate_prior12 > 0 then greatest(0.5, least(2, b.rate12 / b.rate_prior12)) else 1 end as trend',
    $t$case when b.trend_ok and b.rate_prior12 > 0 and b.mp12 >= 10 then greatest(0.5, least(1.3, b.rate_y / b.rate_prior12)) else 1 end as trend$t$);

  execute d;
end
$do$;
