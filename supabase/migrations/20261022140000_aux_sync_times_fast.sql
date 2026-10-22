-- get_dashboard_aux took about 4.5 of its 4.7 seconds working out the "last synced" times: it evaluated a CASE and an
-- ILIKE on every one of the ~940,000 sales rows. The times only need one value per (company, source file), so group
-- first (index only, no per-row text matching) and map the few distinct sources afterwards.
-- Same result as before; the function is patched in place and fails loudly if its text changed.

create index if not exists idx_sales_lines_company_source_synced
  on public.sales_lines (company, line_source) include (synced_at);

do $$
declare
  def text;
  newdef text;
  old_part text := E'          synced_at as ts\n        from sales_lines\n        where company = any(acc.companies)\n          and (line_source ilike ''rep891%'' or line_source in (''722-order'',''721-open-order'',''720-open-delivery'',''855''))\n        union all';
  new_part text := E'          ts\n        from (select company, line_source, max(synced_at) as ts\n              from sales_lines\n              where company = any(acc.companies)\n              group by company, line_source\n              offset 0) g\n        union all';
begin
  def := pg_get_functiondef('public.get_dashboard_aux()'::regprocedure);
  if def like '%group by company, line_source%' then return; end if;
  newdef := replace(def, old_part, new_part);
  if newdef = def then raise exception 'aux_sync_times_fast: sync times block not found in get_dashboard_aux'; end if;
  execute newdef;
end;
$$;
