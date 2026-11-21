-- Data health: alert when the ERP sales export cuts item codes to 11 characters again.
-- Background (2026-11): the 891/894/855 reports cut item codes to 11 characters until the export field was widened; short codes
-- merge different items (RZR-1307342 = RZR-13073420 or RZR-13073427). The widened export is easy to lose silently, so this check
-- looks at the data itself: for each company that had long codes (> 11 characters) in at least 1 % of last year's sales lines, a
-- month of the current year with enough lines (expected long-code lines >= 10) but NO line with a code longer than 11 characters
-- is red. Evaluated inside the checker's content window, like the other content checks. Nothing to change in the sync.
-- Replaces data_health_content(): sections 1 and 2 are unchanged from 20261102110000; section 3 is new.

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
  cy int;
  ref_n bigint;
  ref_long bigint;
  share numeric;
  bad text;
  co_name text;
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

  -- 2. new in-stock items without a category, per company (unchanged)
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

  -- 3. item codes cut to 11 characters (new)
  cy := extract(year from (now() at time zone 'Asia/Jerusalem'))::int;
  for co in select unnest(array['pupik', 'mt', 'gold']) loop
    select count(*), count(*) filter (where length(l.item_sku) > 11) into ref_n, ref_long
      from sales_lines l where l.company = co and l.year = cy - 1 and l.line_source like 'rep891%';
    -- no baseline of long codes (too little data, or the company never had them): nothing to compare with
    if ref_n < 1000 or ref_long::numeric / ref_n < 0.01 then continue; end if;
    share := ref_long::numeric / ref_n;

    select string_agg(to_char(make_date(cy, m.mo, 1), 'Mon'), ', ' order by m.mo) into bad
    from (select extract(month from l.line_date)::int as mo, count(*) as n,
                 count(*) filter (where length(l.item_sku) > 11) as long_n
          from sales_lines l
          where l.company = co and l.year = cy and l.line_source = 'rep891' || co
          group by 1) m
    where m.long_n = 0 and m.n * share >= 10;

    co_name := case co when 'pupik' then 'Pupik' when 'mt' then 'Monkeytime' when 'gold' then 'Goldbug' else co end;
    check_key := 'content:codes:' || co; file_group := 'content'; company := co;
    label := 'item codes in sales are not cut to 11 characters'; newest := null;
    if bad is not null then
      alert_status := 'red';
      alert_reason := co_name || ' sales for ' || bad || ' have no item code longer than 11 characters (last year about '
        || round(share * 100) || ' % of the lines did): the ERP export is cutting item codes again - widen the item-code field in the export (report 891 / 894) and re-export';
    else
      alert_status := 'green'; alert_reason := 'item codes are not cut';
    end if;
    return next;
  end loop;
end;
$$;
revoke all on function public.data_health_content() from public, anon, authenticated;
grant execute on function public.data_health_content() to service_role;
