-- Year-scoped dashboard loading. The dashboard now downloads this year and last year first and fetches any older
-- year only when someone asks for it (Admin: the 2020-2023 history made the full download about 944,000 rows).
--
--   get_dashboard_sales_boundaries_y(p_page_rows, p_years)  same as get_dashboard_sales_boundaries, limited to p_years
--   get_dashboard_sales_range_y(p_from_id, p_to_id, p_years)  same as get_dashboard_sales_range_v2, limited to p_years
--   get_dashboard_sales_years()   the (company, year) pairs this user may open, with a row count and last sync time
--                                 (the app keeps older years on the device and re-downloads one only when this changes)
--   get_cache_key()               a per-user random key, used by the app to encrypt its on-device copy; the app
--                                 keeps it in memory only, so the stored copy is unreadable without a signed-in session
--
-- The _y functions are derived from the live definitions by text replace (like hidden_years) so the access rules
-- (companies, agents, hidden years, this-year-only) cannot drift; the block fails loudly if the text is not found.
-- The old functions stay untouched as the automatic fallback.

do $$
declare
  def text;
  newdef text;
begin
  -- 1. range
  def := pg_get_functiondef('public.get_dashboard_sales_range_v2(bigint,bigint)'::regprocedure);
  newdef := replace(def,
    'get_dashboard_sales_range_v2(p_from_id bigint, p_to_id bigint)',
    'get_dashboard_sales_range_y(p_from_id bigint, p_to_id bigint, p_years integer[])');
  if newdef = def then raise exception 'year_scoped: range signature not found'; end if;
  def := newdef;
  newdef := replace(def,
    'where s.id >= p_from_id and s.id <= p_to_id',
    E'where s.id >= p_from_id and s.id <= p_to_id\n      and s.year = any(p_years)');
  if newdef = def then raise exception 'year_scoped: range filter anchor not found'; end if;
  execute newdef;

  -- 2. boundaries
  def := pg_get_functiondef('public.get_dashboard_sales_boundaries(integer)'::regprocedure);
  newdef := replace(def,
    'get_dashboard_sales_boundaries(p_page_rows integer DEFAULT 25000)',
    'get_dashboard_sales_boundaries_y(p_page_rows integer, p_years integer[])');
  if newdef = def then raise exception 'year_scoped: boundaries signature not found'; end if;
  def := newdef;
  newdef := replace(def,
    'where s.company = any(acc.companies)',
    E'where s.company = any(acc.companies)\n      and s.year = any(p_years)');
  if newdef = def then raise exception 'year_scoped: boundaries filter anchor not found'; end if;
  execute newdef;
end;
$$;

grant execute on function public.get_dashboard_sales_range_y(bigint, bigint, integer[]) to authenticated;
grant execute on function public.get_dashboard_sales_boundaries_y(integer, integer[]) to authenticated;

-- 3. the years a user may open
create or replace function public.get_dashboard_sales_years()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; res jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object('company', y.company, 'year', y.year, 'rows', y.n, 'synced', y.last_sync)
                            order by y.year, y.company), '[]'::jsonb)
    into res
  from (
    select s.company, s.year, count(*) as n, max(s.synced_at) as last_sync
    from sales_lines s
    where s.company = any(acc.companies)
      and s.year is not null
      and s.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (acc.agents is null or array_length(acc.agents,1) is null or s.agent_erp_id = any(acc.agents))
      and (s.line_source ilike 'rep891%'
           or s.line_source in ('722-order','721-open-order','720-open-delivery','855'))
    group by s.company, s.year
  ) y;
  return res;
end;
$function$;
grant execute on function public.get_dashboard_sales_years() to authenticated;

-- 4. per-user key for the encrypted copy on the device
create table if not exists public.dashboard_cache_keys (
  user_id uuid primary key,
  key bytea not null,
  created_at timestamptz not null default now()
);
alter table public.dashboard_cache_keys enable row level security;
revoke all on public.dashboard_cache_keys from anon, authenticated;

create or replace function public.get_cache_key()
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare acc dashboard_user_access; k bytea;
begin
  if auth.uid() is null then return null; end if;
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null or acc.active is not true then return null; end if;
  select key into k from dashboard_cache_keys where user_id = auth.uid();
  if k is null then
    k := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
    insert into dashboard_cache_keys (user_id, key) values (auth.uid(), k)
    on conflict (user_id) do nothing;
    select key into k from dashboard_cache_keys where user_id = auth.uid();
  end if;
  return encode(k, 'base64');
end;
$function$;
grant execute on function public.get_cache_key() to authenticated;
