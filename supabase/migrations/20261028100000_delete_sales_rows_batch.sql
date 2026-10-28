-- Used by the sync (release v033): delete one batch of sales_lines rows of a (company, line_source[, year, month]) scope,
-- restricted to min_id < id <= max_id. The sync inserts a file's new rows FIRST and removes the previous rows afterwards
-- (previous = id up to the highest id seen before the load), or removes the rows a failed load added (id above that mark).
-- A plain DELETE / ORDER BY id probe through the API ran into the statement timeout on the full table (v032 test sync);
-- this function runs in bounded batches with its own timeout, like delete_sales_scope_batch.
create or replace function public.delete_sales_rows_batch(
  p_company text,
  p_line_source text,
  p_year integer default null,
  p_month integer default null,
  p_min_id bigint default 0,
  p_max_id bigint default null,
  p_limit integer default 10000)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  n bigint;
begin
  set local statement_timeout = '120s';
  delete from public.sales_lines
    where ctid in (
      select ctid from public.sales_lines
      where company = p_company and line_source = p_line_source
        and (p_year is null or year = p_year)
        and (p_month is null or month = p_month)
        and id > coalesce(p_min_id, 0)
        and (p_max_id is null or id <= p_max_id)
      limit p_limit
    );
  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function public.delete_sales_rows_batch(text, text, integer, integer, bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.delete_sales_rows_batch(text, text, integer, integer, bigint, bigint, integer) to service_role;
