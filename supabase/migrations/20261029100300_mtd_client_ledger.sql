-- Sales MTD "extended report": the signed-in user's clients (number, name, cash), each client's invoices, each
-- invoice's lines. Three SECURITY DEFINER functions, all read-only, all lazy (one level per call, capped).
--
-- Scope = exactly what the Sales MTD card already uses (get_dashboard_sales_range_v2), enforced here in the database:
--   * company must be in the access row's companies
--   * only rep891% invoice lines of the CURRENT month (Asia/Jerusalem), same as computeSalesMtd
--   * a user limited to agents (dashboard_user_access.agents non-empty) sees only lines whose agent_erp_id is one of
--     them -> a client's cash / invoices / lines are the user's own part, never another agent's
--   * the user's hidden_years are honoured
-- Cash = sum of sales_lines.cash of those lines, i.e. the same "Cash" figure as the Sales MTD card, per client.
-- Open debt (client_debt_lines, same company + agent scope) is returned beside it as a separate informational figure.
--
-- "View as": p_as is the user being previewed. It is honoured only for a real super admin; for anyone else it is
-- ignored and the caller's own access applies.

create or replace function public.mtd_ledger_gate(p_company text, p_as uuid default null)
returns dashboard_user_access
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare acc dashboard_user_access; previewing boolean;
begin
  previewing := p_as is not null and p_as <> auth.uid() and is_super_admin();
  acc := get_dashboard_access(case when previewing then p_as else auth.uid() end);
  if acc.user_id is null or p_company is null or not (p_company = any(coalesce(acc.companies, '{}'))) then
    return null;
  end if;
  if coalesce(acc.active, true) = false then return null; end if;
  return acc;
end;
$function$;
revoke all on function public.mtd_ledger_gate(text, uuid) from public, anon, authenticated;

-- 1) Clients with sales this month: client number, name, cash (+ open debt), biggest first. Paged, searchable.
create or replace function public.get_mtd_client_ledger(
  p_company text,
  p_query text default null,
  p_limit int default 100,
  p_offset int default 0,
  p_as uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access; lim boolean; q text; lm int; off int; cur_y int; cur_m int; res jsonb;
begin
  acc := mtd_ledger_gate(p_company, p_as);
  if acc.user_id is null then return jsonb_build_object('total', 0, 'rows', '[]'::jsonb); end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
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
      and (not lim or s.agent_erp_id = any(acc.agents))
      and s.client_id is not null
      and (q = '' or strpos(lower(s.client_id), q) > 0 or strpos(lower(coalesce(s.client_name, '')), q) > 0)
    group by s.client_id
  ),
  d as (
    select l.erp_client_id as client_id, sum(l.amount) as debt
    from client_debt_lines l
    where l.company = p_company
      and (not lim or l.agent_erp_id = any(acc.agents))
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
revoke all on function public.get_mtd_client_ledger(text, text, int, int, uuid) from public, anon;
grant execute on function public.get_mtd_client_ledger(text, text, int, int, uuid) to authenticated;

-- 2) One client's invoices this month (document number, type, date, lines, qty, amount).
create or replace function public.get_mtd_client_invoices(
  p_company text,
  p_client_id text,
  p_as uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; lim boolean; cur_y int; cur_m int; res jsonb;
begin
  acc := mtd_ledger_gate(p_company, p_as);
  if acc.user_id is null or p_client_id is null then return '[]'::jsonb; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
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
      and (not lim or s.agent_erp_id = any(acc.agents))
    group by coalesce(s.doc_num, ''), coalesce(s.doc_type, '')
    order by min(s.line_date) desc, coalesce(s.doc_num, '') desc
    limit 200
  ) r;
  return res;
end;
$function$;
revoke all on function public.get_mtd_client_invoices(text, text, uuid) from public, anon;
grant execute on function public.get_mtd_client_invoices(text, text, uuid) to authenticated;

-- 3) One invoice's lines (item, qty, total, unit price = total / qty).
create or replace function public.get_mtd_invoice_lines(
  p_company text,
  p_client_id text,
  p_doc_type text,
  p_doc_num text,
  p_as uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; lim boolean; cur_y int; cur_m int; res jsonb;
begin
  acc := mtd_ledger_gate(p_company, p_as);
  if acc.user_id is null or p_client_id is null or p_doc_num is null then return '[]'::jsonb; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
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
      and (not lim or s.agent_erp_id = any(acc.agents))
    order by s.id
    limit 500
  ) r;
  return res;
end;
$function$;
revoke all on function public.get_mtd_invoice_lines(text, text, text, text, uuid) from public, anon;
grant execute on function public.get_mtd_invoice_lines(text, text, text, text, uuid) to authenticated;
