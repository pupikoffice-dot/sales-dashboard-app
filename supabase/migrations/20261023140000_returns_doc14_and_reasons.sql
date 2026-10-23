-- Returns, defined the way the owner defines them: a return is a credit invoice, document type 14 of the sales report 891.
--   return rate = documents 14 in cash / (revenue including the returns)
--   so with 400K net revenue and 200K of document 14 the rate is 200K / 600K.
-- purchase_facts keeps "sold" = every 891 line that is not document 14 (positive lines and the small other credits),
-- "returned" = document 14 credits. The 855 returns report is NOT added on top: every one of its lines is already a
-- document-14 line of 891 (checked: 107 of 107 for Pupik, September), it only carries the return REASON.
-- Reasons (855 Pupik: column P = reason number, column Q = description; 855 MT has none) are stored on the 855 lines
-- (new columns) and matched to the document-14 lines by client, item, quantity and date.
--
-- Also: the daily-stock rebuild no longer counts the 855 lines as a second return into stock.

alter table public.sales_lines add column if not exists return_reason_code text;
alter table public.sales_lines add column if not exists return_reason text;

create or replace function public.refresh_purchase_facts(p_company text)
returns integer
language plpgsql
security definer
set search_path to 'public'
set statement_timeout to '120s'
as $function$
declare
  n integer;
begin
  delete from purchase_facts where company = p_company;

  insert into purchase_facts (
    company, client_id, item_sku, year, month,
    qty_sold, cash_sold, docs_sold, qty_returned, cash_returned, docs_returned, qty_ordered,
    first_date, last_date, intergroup)
  select p_company, s.client_id, s.item_sku, s.year, s.month,
    coalesce(sum(s.qty)        filter (where s.kind = 'sold'), 0),
    coalesce(sum(s.cash)       filter (where s.kind = 'sold'), 0),
    coalesce(count(distinct s.doc_num) filter (where s.kind = 'sold' and s.doc_num is not null), 0),
    coalesce(sum(abs(s.qty))   filter (where s.kind = 'returned'), 0),
    coalesce(sum(abs(s.cash))  filter (where s.kind = 'returned'), 0),
    coalesce(count(distinct s.doc_num) filter (where s.kind = 'returned' and s.doc_num is not null), 0),
    coalesce(sum(s.qty)        filter (where s.kind = 'ordered'), 0),
    min(s.line_date) filter (where s.kind = 'sold'),
    max(s.line_date) filter (where s.kind = 'sold'),
    exists (select 1 from intergroup_clients g
             where g.company = p_company and g.client_id = s.client_id)
  from (
    select client_id, item_sku, year, month, line_date, qty, cash, doc_num,
      case
        when line_source = '722-order' then 'ordered'
        when doc_type = '14' and cash < 0 then 'returned'
        else 'sold'
      end as kind
    from sales_lines
    where company = p_company
      and client_id is not null
      and item_sku is not null
      and (line_source = '722-order' or line_source like 'rep891%')
  ) s
  group by s.client_id, s.item_sku, s.year, s.month;

  get diagnostics n = row_count;
  return n;
end;
$function$;
revoke all on function public.refresh_purchase_facts(text) from public, anon, authenticated;

create or replace function public.stock_net_change(p_company text, p_from date, p_to date)
returns table (sku text, day date, net numeric)
language sql
stable
set search_path to 'public'
as $function$
  select u.sku, u.day, sum(u.qty) as net
  from (
    select m.item_sku as sku, m.move_date as day, m.qty
    from stock_moves m
    where m.company = p_company and m.move_date between p_from and p_to
    union all
    select s.item_sku, s.line_date,
           -(case when coalesce(s.cash, 0) < 0 then -abs(s.qty) else s.qty end)
    from sales_lines s
    where s.company = p_company and s.line_date between p_from and p_to
      and s.item_sku is not null and s.qty is not null
      and s.line_source like 'rep891%'
  ) u
  group by u.sku, u.day;
$function$;

drop function if exists public.get_client_credit_check(text, text, uuid);

create or replace function public.get_client_credit_check(p_company text, p_client_id text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; lim boolean; owner text; res jsonb; since date;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  owner := client_owner_of(p_company, p_client_id);
  if lim and (owner is null or not (owner = any(acc.agents))) then return null; end if;
  since := ((now() at time zone 'Asia/Jerusalem')::date - interval '12 months')::date;

  with l as (
    select s.line_date, s.item_sku, s.qty, s.cash, s.doc_type
    from sales_lines s
    where s.company = p_company and s.client_id = p_client_id
      and s.line_source like 'rep891%' and s.item_sku is not null
      and s.line_date >= since - 90
      and s.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
  ),
  credits as (select * from l where doc_type = '14' and cash < 0 and line_date >= since),
  tagged as (
    select c.cash, c.line_date, c.item_sku, c.qty,
      exists (select 1 from l p where p.item_sku = c.item_sku and p.cash > 0 and abs(p.qty + c.qty) < 0.01
                and p.line_date > c.line_date and p.line_date <= c.line_date + 30) as reissued,
      exists (select 1 from l p where p.item_sku = c.item_sku and p.cash > 0 and abs(p.qty + c.qty) < 0.01
                and p.line_date between c.line_date - 90 and c.line_date) as earlier,
      (select r.return_reason_code || '|' || coalesce(r.return_reason, '')
         from sales_lines r
        where r.company = p_company and r.client_id = p_client_id and r.line_source = '855'
          and r.item_sku = c.item_sku and r.line_date = c.line_date and abs(r.qty - c.qty) < 0.01
          and r.return_reason_code is not null
        limit 1) as reason
    from credits c
  ),
  by_reason as (
    select reason, sum(-cash) as cash, count(*) as lines from tagged where reason is not null group by reason
  )
  select jsonb_build_object(
    'credits12', (select coalesce(sum(-cash), 0) from tagged),
    'reissued12', (select coalesce(sum(-cash) filter (where reissued), 0) from tagged),
    'reverses12', (select coalesce(sum(-cash) filter (where not reissued and earlier), 0) from tagged),
    'other12', (select coalesce(sum(-cash) filter (where not reissued and not earlier), 0) from tagged),
    'creditLines12', (select count(*) from tagged),
    'withReason12', (select coalesce(sum(-cash) filter (where reason is not null), 0) from tagged),
    'reasons', (select coalesce(jsonb_agg(jsonb_build_object('code', split_part(reason, '|', 1), 'text', split_part(reason, '|', 2),
                  'cash', cash, 'lines', lines) order by cash desc), '[]'::jsonb) from by_reason)
  ) into res;
  return res;
end;
$function$;
grant execute on function public.get_client_credit_check(text, text, uuid) to authenticated;

-- Return reasons for a whole company (all clients the caller may see): the reasons known so far and their cash.
create or replace function public.get_return_reasons(p_company text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; lim boolean; mine text[]; res jsonb;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  if lim then
    select coalesce(array_agg(o.client_id), '{}') into mine from client_owner_v(p_company) o where o.agent_id = any(acc.agents);
  end if;
  select jsonb_build_object(
    'from', (select min(line_date) from sales_lines where company = p_company and line_source = '855' and return_reason_code is not null),
    'to', (select max(line_date) from sales_lines where company = p_company and line_source = '855' and return_reason_code is not null),
    'reasons', coalesce(jsonb_agg(jsonb_build_object('code', t.code, 'text', t.txt, 'cash', t.cash, 'lines', t.lines) order by t.cash desc), '[]'::jsonb))
  into res
  from (
    select r.return_reason_code as code, max(r.return_reason) as txt, sum(-r.cash) as cash, count(*) as lines
    from sales_lines r
    where r.company = p_company and r.line_source = '855' and r.return_reason_code is not null
      and r.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (not lim or r.client_id = any(mine))
    group by r.return_reason_code
  ) t;
  return res;
end;
$function$;
grant execute on function public.get_return_reasons(text, uuid) to authenticated;
