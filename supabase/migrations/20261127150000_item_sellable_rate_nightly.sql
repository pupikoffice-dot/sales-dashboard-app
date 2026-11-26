-- Order recommendation speed: compute the in-stock sales rate (item_sellable_rate) once a night instead of on every
-- page open. The rate only looks at days up to YESTERDAY, so a result computed in the night is exact for the whole day.
--
--   item_sellable_rate_store   one row per company + item, for the day it was computed for (computed_for)
--   item_sellable_rate_runs    one row per company: which day the store holds, when it ran, how many rows, how long
--   refresh_item_sellable_rate(company)   recomputes one company (replaces its rows in one transaction)
--   item_sellable_rate_fast(company, day) what order_engine now calls: the stored rows when they are for that day,
--                                         otherwise the live calculation (so a missed night is slower, never wrong)
-- Nightly job 02:20 UTC, after the stock history rebuild (01:40) and the purchase-facts refresh (01:50) it depends on.

create table if not exists public.item_sellable_rate_store (
  company      text    not null,
  sku          text    not null,
  basis        text,
  sell_days    integer,
  sell_qty     numeric,
  rate_wd      numeric,
  threshold    numeric,
  unknown_days integer,
  low_days     integer,
  early_days   integer,
  primary key (company, sku)
);
alter table public.item_sellable_rate_store enable row level security;   -- no policies: internal, engine reads it as owner

create table if not exists public.item_sellable_rate_runs (
  company      text primary key,
  computed_for date not null,
  computed_at  timestamptz not null default now(),
  row_count    integer not null,
  seconds      numeric
);
alter table public.item_sellable_rate_runs enable row level security;

create or replace function public.refresh_item_sellable_rate(p_company text, p_today date default current_date)
returns integer
language plpgsql
security definer
set search_path to 'public'
set statement_timeout to '120s'
as $function$
declare
  t0 timestamptz := clock_timestamp();
  n  integer;
begin
  delete from item_sellable_rate_store where company = p_company;
  insert into item_sellable_rate_store (company, sku, basis, sell_days, sell_qty, rate_wd, threshold, unknown_days, low_days, early_days)
  select p_company, r.sku, r.basis, r.sell_days, r.sell_qty, r.rate_wd, r.threshold, r.unknown_days, r.low_days, r.early_days
    from item_sellable_rate(p_company, p_today) r;
  get diagnostics n = row_count;
  insert into item_sellable_rate_runs (company, computed_for, computed_at, row_count, seconds)
  values (p_company, p_today, now(), n, round(extract(epoch from clock_timestamp() - t0)::numeric, 1))
  on conflict (company) do update
     set computed_for = excluded.computed_for, computed_at = excluded.computed_at,
         row_count = excluded.row_count, seconds = excluded.seconds;
  return n;
end
$function$;

create or replace function public.item_sellable_rate_fast(p_company text, p_today date default current_date)
returns table (sku text, basis text, sell_days integer, sell_qty numeric, rate_wd numeric, threshold numeric,
               unknown_days integer, low_days integer, early_days integer)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if exists (select 1 from item_sellable_rate_runs r where r.company = p_company and r.computed_for = p_today) then
    return query
      select s.sku, s.basis, s.sell_days, s.sell_qty, s.rate_wd, s.threshold, s.unknown_days, s.low_days, s.early_days
        from item_sellable_rate_store s where s.company = p_company;
  else
    return query select * from item_sellable_rate(p_company, p_today);
  end if;
end
$function$;

revoke all on function public.refresh_item_sellable_rate(text, date) from public, anon, authenticated;
revoke all on function public.item_sellable_rate_fast(text, date) from public, anon, authenticated;

-- order_engine: call the fast version (exact-text replace, fails loudly if the text is not found).
do $mig$
declare
  d text;
  r_old constant text := 'left join item_sellable_rate(p_company, p_today) sr on sr.sku = c.sku';
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p
   where p.proname = 'order_engine' and p.pronamespace = 'public'::regnamespace
     and pg_get_function_identity_arguments(p.oid) = 'p_company text, p_today date, p_include_hidden boolean';
  if d is null then raise exception 'order_engine not found'; end if;
  if position('item_sellable_rate_fast' in d) > 0 then return; end if;   -- already patched
  if position(r_old in d) = 0 then raise exception 'order_engine text is not as expected; not patched'; end if;
  d := replace(d, r_old, 'left join item_sellable_rate_fast(p_company, p_today) sr on sr.sku = c.sku');
  execute d;   -- same return type
  execute 'revoke all on function public.order_engine(text, date, boolean) from public, anon, authenticated';
  execute 'grant execute on function public.order_engine(text, date, boolean) to service_role';
end
$mig$;

-- nightly job (re-scheduling with the same name replaces it)
select cron.schedule('refresh-item-sellable-rate', '20 2 * * *',
  $$select public.refresh_item_sellable_rate('pupik'); select public.refresh_item_sellable_rate('mt'); select public.refresh_item_sellable_rate('gold');$$);

-- fill it now so the page is fast from today
select public.refresh_item_sellable_rate('pupik');
select public.refresh_item_sellable_rate('mt');
select public.refresh_item_sellable_rate('gold');
