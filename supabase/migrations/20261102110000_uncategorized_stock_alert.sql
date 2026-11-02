-- Data health: alert when NEW items appear in stock without a category (REP103 column I).
-- Owner decision 2026-11-02 (option A): not a standing count (hundreds of items are uncategorised today) but what is new.
-- An item is "new" for 24 h after the checker first sees it in stock and uncategorised. An item that gets a category is
-- forgotten, so it counts as new again if it ever loses it. Items that merely leave stock are kept, so a stock-file reload
-- cannot make old items look new. The first run for a company only records the baseline (nothing is new yet).

create table if not exists public.uncategorized_stock_seen (
  company text not null,
  sku text not null,
  first_seen_at timestamptz not null default now(),
  primary key (company, sku)
);
alter table public.uncategorized_stock_seen enable row level security;  -- service role only (no policies)

-- Replaces data_health_content(): same columns plus alert_status / alert_reason (null = date-based check, as before).
drop function if exists public.data_health_content();
create or replace function public.data_health_content()
returns table(check_key text, file_group text, company text, label text, newest date, alert_status text, alert_reason text)
language plpgsql volatile security definer set search_path to 'public' set statement_timeout to '60s' as $$
#variable_conflict use_column
declare
  co text;
  n_stock int;
  n_new int;
  sample text;
  first_run boolean;
begin
  -- 1. date-based checks (unchanged)
  return query
  with src(company, line_source, label) as (values
    ('pupik', 'rep891pupik',      'sales (891) loaded in the database'),
    ('mt',    'rep891mt',         'sales (891) loaded in the database'),
    ('pupik', '722-order',        'orders (722) loaded in the database'),
    ('mt',    '722-order',        'orders (722) loaded in the database'),
    ('pupik', '720-open-delivery','open deliveries (720) loaded in the database'),
    ('mt',    '720-open-delivery','open deliveries (720) loaded in the database'))
  select 'content:' || s.line_source || ':' || s.company, 'content', s.company, s.label,
         (select max(l.line_date) from public.sales_lines l
           where l.company = s.company and l.line_source = s.line_source
             and l.year >= extract(year from current_date)::int - 1),
         null::text, null::text
  from src s;

  -- 2. new in-stock items without a category, per company
  for co in select unnest(array['pupik', 'mt']) loop
    create temporary table if not exists _nocat_now (sku text primary key) on commit drop;
    truncate _nocat_now;
    create temporary table if not exists _cat_now (sku text primary key) on commit drop;
    truncate _cat_now;

    -- categorised in the company's latest REP103 load (same "latest" rule as get_item_index)
    insert into _cat_now
    select c.sku from item_catalog c
    where c.company = co and nullif(btrim(c.tablet_cat), '') is not null
      and c.synced_at >= (select max(i.synced_at) from item_catalog i where i.company = co) - interval '2 hours'
    on conflict do nothing;

    insert into _nocat_now
    select i.sku from inventory i
    where i.company = co and btrim(i.sku) <> 'סך הכל'
    group by i.sku having sum(i.qty_on_hand) > 0
    on conflict do nothing;
    delete from _nocat_now where sku in (select sku from _cat_now);

    select count(*) into n_stock from inventory i where i.company = co;
    -- a half-loaded stock or catalog must not rewrite the baseline
    if n_stock < 100 or (select count(*) from _cat_now) < 100 then continue; end if;

    first_run := not exists (select 1 from uncategorized_stock_seen where company = co);
    delete from uncategorized_stock_seen u where u.company = co and u.sku in (select sku from _cat_now);
    insert into uncategorized_stock_seen (company, sku, first_seen_at)
    select co, sku, case when first_run then timestamptz 'epoch' else now() end from _nocat_now
    on conflict do nothing;

    select string_agg(u.sku, ', ' order by u.sku) into sample
    from (select s.sku from uncategorized_stock_seen s
          join _nocat_now n on n.sku = s.sku
          where s.company = co and s.first_seen_at > now() - interval '24 hours'
          order by s.sku limit 5) u;
    select count(*) into n_new from uncategorized_stock_seen s
      join _nocat_now n on n.sku = s.sku
      where s.company = co and s.first_seen_at > now() - interval '24 hours';

    check_key := 'content:nocat:' || co; file_group := 'content'; company := co;
    label := 'items in stock without a category (REP103 column I)'; newest := null;
    if n_new > 0 then
      alert_status := 'red';
      alert_reason := n_new || ' item(s) newly in stock without a category: ' || coalesce(sample, '') ||
        case when n_new > 5 then ', ...' else '' end || ' - set column I in the ERP (list: Items > In stock, no category)';
    else
      alert_status := 'green'; alert_reason := 'no new uncategorised items in stock';
    end if;
    return next;
  end loop;
end;
$$;
revoke all on function public.data_health_content() from public, anon, authenticated;
grant execute on function public.data_health_content() to service_role;
