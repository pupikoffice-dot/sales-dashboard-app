-- 1) Deals per Range for one client or chain (client card).
-- 2) Client card: "last bought" and "months bought" count only real purchases (positive quantity), not credit notes.
--    Before, a credit note dated after the last purchase made a stopped item show a recent "last bought" date.

-- Positive invoices of the given clients (same rules as deals_docs, but limited to the clients so it stays fast).
create or replace function public.deals_docs_for_clients(p_company text, p_hidden int[], p_members text[])
returns table(doc_type text, doc_num text, doc_date date, client_id text, client_name text, total numeric, n_lines int)
language sql stable security definer set search_path to 'public'
as $$
  select s.doc_type, s.doc_num, max(s.line_date) as doc_date, max(s.client_id) as client_id, max(s.client_name) as client_name,
         sum(s.cash) as total, count(*)::int as n_lines
  from sales_lines s
  where s.company = p_company and s.line_source like 'rep891%'
    and s.client_id = any(p_members)
    and s.doc_type between '11' and '19' and s.doc_num is not null
    and s.line_date >= (date_trunc('month', (now() at time zone 'Asia/Jerusalem')::date) - interval '25 months')::date
    and s.year <> all(coalesce(p_hidden, '{}'::int[]))
  group by s.doc_type, s.doc_num
  having sum(s.cash) > 0;
$$;
revoke all on function public.deals_docs_for_clients(text, int[], text[]) from public, anon, authenticated;

create or replace function public.get_client_deals_per_range(p_company text, p_client_id text, p_as uuid default null)
returns jsonb
language plpgsql stable security definer set search_path to 'public' set statement_timeout to '60s'
as $function$
declare acc dashboard_user_access; today date; months text[]; res jsonb; keys text[]; members text[]; lim boolean; owner text;
begin
  acc := purchase_cards_gate(p_company, p_as, 'rnd_client_card');
  if acc.user_id is null then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  -- same client / chain scope rules as get_client_card
  if p_client_id like 'chain:%' then
    select coalesce(array_agg(cc.client_id), '{}') into members
    from client_chains cc
    where cc.company = p_company and cc.chain_id = substr(p_client_id, 7)
      and (not lim or cc.client_id in (select o.client_id from client_owner_v(p_company) o where o.agent_id = any(acc.agents)));
    if coalesce(array_length(members, 1), 0) = 0 then return null; end if;
  else
    owner := client_owner_of(p_company, p_client_id);
    if lim and (owner is null or not (owner = any(acc.agents))) then return null; end if;
    members := array[p_client_id];
  end if;
  today := (now() at time zone 'Asia/Jerusalem')::date;
  select array_agg(to_char(date_trunc('month', today) - make_interval(months => g), 'YYYY-MM') order by g) into months
    from generate_series(1, 12) g;
  keys := array['month', 'quarter', 'd90', 'd365', 'month_py', 'quarter_py', 'd90_py', 'd365_py']
          || (select array_agg('m:' || m order by m desc) from unnest(months) m);
  with d as (select * from deals_docs_for_clients(p_company, acc.hidden_years, members)),
  c as (
    select deal_range_bucket(d.total) as bucket, k as key, count(*) as n
    from d cross join unnest(keys) k
    where deal_in_period(d.doc_date, k)
    group by 1, 2
  ),
  tr as (
    select deal_range_bucket(d.total) as bucket, to_char(d.doc_date, 'YYYY-MM') as ym, count(*) as n
    from d
    where d.doc_date >= make_date(extract(year from today)::int - 1, 1, 1) and d.doc_date <= today
    group by 1, 2
  )
  select jsonb_build_object(
    'asOf', today,
    'months', (select jsonb_agg(m order by m desc) from unnest(months) m),
    'counts', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'key', key, 'n', n)) from c), '[]'::jsonb),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('bucket', bucket, 'ym', ym, 'n', n)) from tr), '[]'::jsonb))
  into res;
  return res;
end;
$function$;
revoke all on function public.get_client_deals_per_range(text, text, uuid) from public, anon;
grant execute on function public.get_client_deals_per_range(text, text, uuid) to authenticated;

-- get_client_card: patch the live definition in place (it was patched by earlier migrations too); fails loudly if the text moved.
do $$
declare def text; newdef text; oid_ oid;
begin
  select p.oid into oid_ from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'get_client_card';
  def := pg_get_functiondef(oid_);
  newdef := def;

  -- top items: months bought and last bought from real purchases only
  newdef := replace(newdef,
    E'count(distinct ym) as months_bought, max(last_date) as last_date\n    from named where ym > cur - 12',
    E'count(distinct ym) filter (where qty_sold > 0) as months_bought, max(last_date) filter (where qty_sold > 0) as last_date\n    from named where ym > cur - 12');
  if newdef = def then raise exception 'client card: top_items block not found'; end if;
  def := newdef;

  -- stopped items: same, in the column list and in the "bought in at least 3 of the earlier months" test
  newdef := replace(newdef,
    E'count(distinct ym) filter (where ym between cur - 14 and cur - 3) as months_bought,\n           max(last_date) as last_date',
    E'count(distinct ym) filter (where ym between cur - 14 and cur - 3 and qty_sold > 0) as months_bought,\n           max(last_date) filter (where qty_sold > 0) as last_date');
  if newdef = def then raise exception 'client card: stopped columns not found'; end if;
  def := newdef;

  newdef := replace(newdef,
    E'having count(distinct ym) filter (where ym between cur - 14 and cur - 3) >= 3',
    E'having count(distinct ym) filter (where ym between cur - 14 and cur - 3 and qty_sold > 0) >= 3');
  if newdef = def then raise exception 'client card: stopped having not found'; end if;
  def := newdef;

  -- the client's own "last purchase" date
  newdef := replace(newdef,
    E'''last'', (select max(last_date) from f)',
    E'''last'', (select max(last_date) filter (where qty_sold > 0) from f)');
  if newdef = def then raise exception 'client card: last date not found'; end if;

  execute newdef;
end $$;
