-- Years of data a user may not see. An admin ticks the years to show or hide per user (Admin -> Users);
-- unticked years are stored here and filtered out by the database itself, so that data is never sent to the browser.
-- Same model as companies and agents: enforced in the dashboard RPCs (SECURITY DEFINER), not in the interface.
--
-- Covered: sales / orders / open orders / delivery notes / returns rows (get_dashboard_sales_boundaries,
-- get_dashboard_sales_range, get_dashboard_sales_range_v2, get_dashboard_sales_page), receipts by month in
-- get_dashboard_aux, delivery cartons (get_ops_deliveries_monthly, get_ops_delivery_entities) and the receipts
-- month-to-date list (empty when the current year is hidden). NOT covered: the debt aging snapshot, stock, item
-- prices, which have no year of their own.
--
-- The existing definitions are patched in place (text replace on pg_get_functiondef) so nothing else in them can
-- drift; the block fails loudly if a function no longer has the text it expects, and is safe to run twice.

alter table public.dashboard_user_access
  add column if not exists hidden_years integer[] not null default '{}';

do $$
declare
  f record;
  def text;
  newdef text;
  year_sales text := E'\n      and (s.year is null or s.year <> all(coalesce(acc.hidden_years, ''{}''::int[])))';
begin
  -- 1. sales rows: boundaries, both range functions, legacy page
  for f in
    select p.oid, p.proname
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('get_dashboard_sales_boundaries', 'get_dashboard_sales_range',
                        'get_dashboard_sales_range_v2', 'get_dashboard_sales_page')
  loop
    def := pg_get_functiondef(f.oid);
    continue when def like '%hidden_years%';
    newdef := replace(def, 's.company = any(acc.companies)', 's.company = any(acc.companies)' || year_sales);
    if newdef = def then raise exception 'hidden_years: company filter not found in %', f.proname; end if;
    execute newdef;
  end loop;

  -- 2. receipts by month (company totals and by agent) in get_dashboard_aux
  def := pg_get_functiondef('public.get_dashboard_aux()'::regprocedure);
  if def not like '%hidden_years%' then
    newdef := regexp_replace(
      def,
      'from receipt_lines(\s+)where company = any\(acc\.companies\)',
      'from receipt_lines\1where company = any(acc.companies)\1  and extract(year from collected_date)::int <> all(coalesce(acc.hidden_years, ''{}''::int[]))',
      'g');
    if newdef = def then raise exception 'hidden_years: receipt_lines filter not found in get_dashboard_aux'; end if;
    execute newdef;
  end if;

  -- 3. delivery cartons: monthly and entity lists
  for f in
    select p.oid, p.proname
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('get_ops_deliveries_monthly', 'get_ops_delivery_entities')
  loop
    def := pg_get_functiondef(f.oid);
    continue when def like '%hidden_years%';
    newdef := replace(def, 'and l.line_date >= v_start',
      E'and l.line_date >= v_start\n    and extract(year from l.line_date)::int <> all(coalesce(acc.hidden_years, ''{}''::int[]))');
    if newdef = def then raise exception 'hidden_years: line_date filter not found in %', f.proname; end if;
    execute newdef;
  end loop;

  -- 4. receipts month-to-date list: nothing to show while the current year is hidden
  def := pg_get_functiondef('public.get_receipts_mtd_by_client(text,text[])'::regprocedure);
  if def not like '%hidden_years%' then
    newdef := replace(def, 'if not (p_company = any(acc.companies)) then',
      E'if extract(year from (now() at time zone ''Asia/Jerusalem''))::int = any(coalesce(acc.hidden_years, ''{}''::int[])) then\n    return ''[]''::jsonb;\n  end if;\n\n  if not (p_company = any(acc.companies)) then');
    if newdef = def then raise exception 'hidden_years: company check not found in get_receipts_mtd_by_client'; end if;
    execute newdef;
  end if;
end;
$$;
