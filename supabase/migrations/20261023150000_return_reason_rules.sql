-- Which return reasons are NOT real returns. A document-14 credit line whose reason (from the 855 returns report, matched by
-- client, item, quantity and date) is marked counts_as_return = false is treated like any other credit: it stays in the
-- revenue (as a negative line) and is not counted as a return. A reason that is not listed here, and a credit line with no
-- known reason, DOES count as a return (the safe default until the 855 history is exported).
--
-- Pupik reasons seen so far (September 2026): 1 damaged, 6 not sold - no demand, 8 not supplied - client did not accept, 10 manager initiative.

create table if not exists public.return_reason_rules (
  company          text not null,
  code             text not null,
  counts_as_return boolean not null,
  note             text,
  updated_at       timestamptz not null default now(),
  primary key (company, code)
);
alter table public.return_reason_rules enable row level security;
drop policy if exists return_reason_rules_read on public.return_reason_rules;
create policy return_reason_rules_read on public.return_reason_rules for select to authenticated using (true);

-- No rules yet (owner, 2026-10-23: forget the reasons for now; map what appears after the full-year 855 exports).
-- A rule is one row: insert into return_reason_rules (company, code, counts_as_return, note) values ('pupik', '<reason number>', false, '<text>');

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
    select l.client_id, l.item_sku, l.year, l.month, l.line_date, l.qty, l.cash, l.doc_num,
      case
        when l.line_source = '722-order' then 'ordered'
        when l.doc_type = '14' and l.cash < 0 and x.client_id is null then 'returned'
        else 'sold'
      end as kind
    from sales_lines l
    left join (
      -- credit lines whose reason says "not a real return"
      select distinct r.client_id, r.item_sku, r.line_date, round(abs(r.qty), 2) as q
      from sales_lines r
      join return_reason_rules u on u.company = r.company and u.code = r.return_reason_code and not u.counts_as_return
      where r.company = p_company and r.line_source = '855'
    ) x on x.client_id = l.client_id and x.item_sku = l.item_sku and x.line_date = l.line_date
       and x.q = round(abs(l.qty), 2) and l.doc_type = '14' and l.cash < 0
    where l.company = p_company
      and l.client_id is not null
      and l.item_sku is not null
      and (l.line_source = '722-order' or l.line_source like 'rep891%')
  ) s
  group by s.client_id, s.item_sku, s.year, s.month;

  get diagnostics n = row_count;
  return n;
end;
$function$;
revoke all on function public.refresh_purchase_facts(text) from public, anon, authenticated;

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
      (select r.return_reason_code || '|' || coalesce(r.return_reason, '') || '|' || coalesce(u.counts_as_return, true)::text
         from sales_lines r
         left join return_reason_rules u on u.company = r.company and u.code = r.return_reason_code
        where r.company = p_company and r.client_id = p_client_id and r.line_source = '855'
          and r.item_sku = c.item_sku and r.line_date = c.line_date and abs(r.qty - c.qty) < 0.01
          and r.return_reason_code is not null
        limit 1) as reason
    from credits c
  ),
  counted as (
    select *, (reason is not null and split_part(reason, '|', 3) = 'false') as excluded from tagged
  ),
  by_reason as (
    select split_part(reason, '|', 1) as code, max(split_part(reason, '|', 2)) as txt,
           bool_and(split_part(reason, '|', 3) = 'true') as counts, sum(-cash) as cash, count(*) as lines
    from counted where reason is not null group by split_part(reason, '|', 1)
  )
  select jsonb_build_object(
    -- real returns only (credit lines whose reason is "not a return" are left out)
    'credits12', (select coalesce(sum(-cash) filter (where not excluded), 0) from counted),
    'reissued12', (select coalesce(sum(-cash) filter (where not excluded and reissued), 0) from counted),
    'reverses12', (select coalesce(sum(-cash) filter (where not excluded and not reissued and earlier), 0) from counted),
    'other12', (select coalesce(sum(-cash) filter (where not excluded and not reissued and not earlier), 0) from counted),
    'creditLines12', (select count(*) filter (where not excluded) from counted),
    'excluded12', (select coalesce(sum(-cash) filter (where excluded), 0) from counted),
    'withReason12', (select coalesce(sum(-cash) filter (where reason is not null), 0) from counted),
    'reasons', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'text', txt, 'counts', counts,
                  'cash', cash, 'lines', lines) order by cash desc), '[]'::jsonb) from by_reason)
  ) into res;
  return res;
end;
$function$;
grant execute on function public.get_client_credit_check(text, text, uuid) to authenticated;
