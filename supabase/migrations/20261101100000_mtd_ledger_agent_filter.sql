-- Sales MTD extended report: optional agent filter (p_agents) so the Sales Manager suite can show a ledger per agent.
-- p_agents can only NARROW what the caller may see: for a user limited to agents the effective list is the intersection
-- of their own agents and p_agents (an empty intersection returns nothing); an unrestricted user (managers, super admin)
-- gets exactly the agents asked for. null / empty p_agents = the caller's whole scope, as before. The company gate,
-- the rep891 current-month filter, hidden years and View-as handling are unchanged (mtd_ledger_gate).
-- The old signatures are replaced (not overloaded): calls without p_agents keep working through the default.

drop function if exists public.get_mtd_client_ledger(text, text, int, int, uuid);
drop function if exists public.get_mtd_client_invoices(text, text, uuid);
drop function if exists public.get_mtd_invoice_lines(text, text, text, text, uuid);

-- 1) Clients with sales this month: client number, name, cash (+ open debt), biggest first. Paged, searchable.
create or replace function public.get_mtd_client_ledger(
  p_company text,
  p_query text default null,
  p_limit int default 100,
  p_offset int default 0,
  p_as uuid default null,
  p_agents text[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access; lim boolean; eff text[]; q text; lm int; off int; cur_y int; cur_m int; res jsonb;
begin
  acc := mtd_ledger_gate(p_company, p_as);
  if acc.user_id is null then return jsonb_build_object('total', 0, 'rows', '[]'::jsonb); end if;
  lim := (acc.agents is not null and array_length(acc.agents, 1) is not null) or coalesce(array_length(p_agents, 1), 0) > 0;
  eff := case
    when acc.agents is not null and array_length(acc.agents, 1) is not null and coalesce(array_length(p_agents, 1), 0) > 0
      then coalesce((select array_agg(a) from (select unnest(acc.agents) intersect select unnest(p_agents)) x(a)), '{}'::text[])
    when coalesce(array_length(p_agents, 1), 0) > 0 then p_agents
    else acc.agents
  end;
  q := lower(btrim(coalesce(p_query, '')));
  lm := least(greatest(coalesce(p_limit, 100), 1), 200);
  off := greatest(coalesce(p_offset, 0), 0);
  cur_y := extract(year from (now() at time zone 'Asia/Jerusalem'))::int;
  cur_m := extract(month from (now() at time zone 'Asia/Jerusalem'))::int;

  with c as (
    select s.client_id, max(s.client_name) as client_name, sum(s.cash) as cash,
           count(distinct (coalesce(s.doc_type, '') || '/' || coalesce(s.doc_num, ''))) as docs
    from sales_lines s
    where s.company = p_company
      and s.line_source ilike 'rep891%'
      and s.year = cur_y and s.month = cur_m
      and s.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (not lim or s.agent_erp_id = any(eff))
      and s.client_id is not null
      and (q = '' or strpos(lower(s.client_id), q) > 0 or strpos(lower(coalesce(s.client_name, '')), q) > 0)
    group by s.client_id
  ),
  d as (
    select l.erp_client_id as client_id, sum(l.amount) as debt
    from client_debt_lines l
    where l.company = p_company
      and (not lim or l.agent_erp_id = any(eff))
      and l.erp_client_id in (select client_id from c)
    group by l.erp_client_id
  ),
  page as (
    select c.*, d.debt from c left join d using (client_id)
    order by c.cash desc nulls last, c.client_name, c.client_id
    limit lm offset off
  )
  select jsonb_build_object(
    'total', (select count(*) from c),
    'rows', coalesce((select jsonb_agg(jsonb_build_object(
              'clientID', p.client_id, 'clientName', coalesce(p.client_name, ''),
              'cash', coalesce(p.cash, 0), 'docs', p.docs, 'debt', p.debt)
            order by p.cash desc nulls last, p.client_name, p.client_id) from page p), '[]'::jsonb)
  ) into res;
  return res;
end;
$function$;
revoke all on function public.get_mtd_client_ledger(text, text, int, int, uuid, text[]) from public, anon;
grant execute on function public.get_mtd_client_ledger(text, text, int, int, uuid, text[]) to authenticated;

-- 2) One client's invoices this month (document number, type, date, lines, qty, amount).
create or replace function public.get_mtd_client_invoices(
  p_company text,
  p_client_id text,
  p_as uuid default null,
  p_agents text[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; lim boolean; eff text[]; cur_y int; cur_m int; res jsonb;
begin
  acc := mtd_ledger_gate(p_company, p_as);
  if acc.user_id is null or p_client_id is null then return '[]'::jsonb; end if;
  lim := (acc.agents is not null and array_length(acc.agents, 1) is not null) or coalesce(array_length(p_agents, 1), 0) > 0;
  eff := case
    when acc.agents is not null and array_length(acc.agents, 1) is not null and coalesce(array_length(p_agents, 1), 0) > 0
      then coalesce((select array_agg(a) from (select unnest(acc.agents) intersect select unnest(p_agents)) x(a)), '{}'::text[])
    when coalesce(array_length(p_agents, 1), 0) > 0 then p_agents
    else acc.agents
  end;
  cur_y := extract(year from (now() at time zone 'Asia/Jerusalem'))::int;
  cur_m := extract(month from (now() at time zone 'Asia/Jerusalem'))::int;

  select coalesce(jsonb_agg(jsonb_build_object(
           'docNum', r.doc_num, 'docType', r.doc_type, 'date', r.d, 'agent', r.agent,
           'lines', r.lines, 'qty', r.qty, 'cash', r.cash)
         order by r.d desc, r.doc_num desc), '[]'::jsonb)
    into res
  from (
    select coalesce(s.doc_num, '') as doc_num, coalesce(s.doc_type, '') as doc_type,
           to_char(min(s.line_date), 'YYYY-MM-DD') as d, max(s.agent_erp_id) as agent,
           count(*) as lines, sum(s.qty) as qty, sum(s.cash) as cash
    from sales_lines s
    where s.company = p_company
      and s.client_id = p_client_id
      and s.line_source ilike 'rep891%'
      and s.year = cur_y and s.month = cur_m
      and s.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (not lim or s.agent_erp_id = any(eff))
    group by coalesce(s.doc_num, ''), coalesce(s.doc_type, '')
    order by min(s.line_date) desc, coalesce(s.doc_num, '') desc
    limit 200
  ) r;
  return res;
end;
$function$;
revoke all on function public.get_mtd_client_invoices(text, text, uuid, text[]) from public, anon;
grant execute on function public.get_mtd_client_invoices(text, text, uuid, text[]) to authenticated;

-- 3) One invoice's lines (item, qty, total, unit price = total / qty).
create or replace function public.get_mtd_invoice_lines(
  p_company text,
  p_client_id text,
  p_doc_type text,
  p_doc_num text,
  p_as uuid default null,
  p_agents text[] default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; lim boolean; eff text[]; cur_y int; cur_m int; res jsonb;
begin
  acc := mtd_ledger_gate(p_company, p_as);
  if acc.user_id is null or p_client_id is null or p_doc_num is null then return '[]'::jsonb; end if;
  lim := (acc.agents is not null and array_length(acc.agents, 1) is not null) or coalesce(array_length(p_agents, 1), 0) > 0;
  eff := case
    when acc.agents is not null and array_length(acc.agents, 1) is not null and coalesce(array_length(p_agents, 1), 0) > 0
      then coalesce((select array_agg(a) from (select unnest(acc.agents) intersect select unnest(p_agents)) x(a)), '{}'::text[])
    when coalesce(array_length(p_agents, 1), 0) > 0 then p_agents
    else acc.agents
  end;
  cur_y := extract(year from (now() at time zone 'Asia/Jerusalem'))::int;
  cur_m := extract(month from (now() at time zone 'Asia/Jerusalem'))::int;

  select coalesce(jsonb_agg(jsonb_build_object(
           'itemSKU', r.item_sku, 'itemName', r.item_name, 'qty', r.qty, 'cash', r.cash,
           'price', case when coalesce(r.qty, 0) <> 0 then round(r.cash / r.qty, 4) end)
         order by r.id), '[]'::jsonb)
    into res
  from (
    select s.id, s.item_sku, s.item_name, s.qty, s.cash
    from sales_lines s
    where s.company = p_company
      and s.client_id = p_client_id
      and s.doc_num = p_doc_num
      and coalesce(s.doc_type, '') = coalesce(p_doc_type, '')
      and s.line_source ilike 'rep891%'
      and s.year = cur_y and s.month = cur_m
      and s.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (not lim or s.agent_erp_id = any(eff))
    order by s.id
    limit 500
  ) r;
  return res;
end;
$function$;
revoke all on function public.get_mtd_invoice_lines(text, text, text, text, uuid, text[]) from public, anon;
grant execute on function public.get_mtd_invoice_lines(text, text, text, text, uuid, text[]) to authenticated;
