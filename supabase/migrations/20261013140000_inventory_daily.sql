-- Stock history: opening and closing quantity per item per day (Israel time),
-- recorded from the WMS 000 loads. The sync replaces public.inventory on every
-- load, so before this nothing was kept.
--
-- A statement-level trigger on inventory inserts copies each loaded batch:
--   first reading of the day  -> open_qty  (kept)
--   every later reading       -> close_qty (overwritten)
-- inventory_day_runs remembers when the day's first and last loads happened, so
-- an item missing from the first load opened at 0 and one missing from the last
-- load closed at 0 (the export lists only stocked items).
-- No change to the sync is needed.

create table if not exists public.inventory_daily (
  day        date        not null,
  company    text        not null,
  sku        text        not null,
  name       text,
  open_qty   numeric     not null,
  open_at    timestamptz not null,
  close_qty  numeric     not null,
  close_at   timestamptz not null,
  primary key (day, company, sku)
);

create table if not exists public.inventory_day_runs (
  day       date        not null,
  company   text        not null,
  first_at  timestamptz not null,
  last_at   timestamptz not null,
  primary key (day, company)
);

alter table public.inventory_daily enable row level security;
alter table public.inventory_day_runs enable row level security;
-- No policies: read only through get_stock_daily (security definer, company-scoped).

create or replace function public.record_inventory_reading()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare d date := (now() at time zone 'Asia/Jerusalem')::date;
begin
  insert into inventory_daily (day, company, sku, name, open_qty, open_at, close_qty, close_at)
  select d, n.company, n.sku, n.name, n.qty_on_hand, now(), n.qty_on_hand, now()
  from new_rows n
  where btrim(n.sku) <> 'סך הכל'  -- grand-total line of the stock file, not an item
  on conflict (day, company, sku) do update
    set close_qty = excluded.close_qty,
        close_at  = excluded.close_at,
        name      = coalesce(excluded.name, inventory_daily.name);

  insert into inventory_day_runs (day, company, first_at, last_at)
  select d, n.company, now(), now()
  from new_rows n
  group by n.company
  on conflict (day, company) do update set last_at = excluded.last_at;

  return null;
end;
$function$;

drop trigger if exists inventory_record_reading on public.inventory;
create trigger inventory_record_reading
  after insert on public.inventory
  referencing new table as new_rows
  for each statement
  execute function public.record_inventory_reading();

-- Opening / closing stock per item and day for one company, within the caller's companies.
create or replace function public.get_stock_daily(p_company text, p_from date, p_to date)
 returns table (day date, sku text, name text, open_qty numeric, close_qty numeric)
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare acc dashboard_user_access;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null or not (p_company = any(acc.companies)) then
    return;
  end if;
  return query
  select d.day, d.sku, d.name,
         case when d.open_at  > r.first_at + interval '10 minutes' then 0 else d.open_qty  end,
         case when d.close_at < r.last_at  - interval '10 minutes' then 0 else d.close_qty end
  from inventory_daily d
  join inventory_day_runs r on r.day = d.day and r.company = d.company
  where d.company = p_company and d.day between p_from and p_to
  order by d.day, d.sku;
end;
$function$;

revoke all on function public.get_stock_daily(text, date, date) from public, anon;
grant execute on function public.get_stock_daily(text, date, date) to authenticated;
