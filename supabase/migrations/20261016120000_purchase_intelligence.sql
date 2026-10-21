-- Purchase intelligence (R&D): the data foundation.
--
-- What was bought is the invoice and delivery-note lines (report 891, including the year files) minus the
-- credit-note lines (855 and the negative document types inside 891). Orders (722/721/720) are never added to
-- totals, so nothing is counted twice. The excluded sources 854/887/888 stay excluded.
--
-- stock_moves holds the stock movements the demand factors need: imports (B8), local purchases (76, including
-- intergroup) and returns to stock. No report feeds it yet; the loader lands with those reports.
-- intergroup_clients flags group companies that buy from each other, on the selling company's side, so every
-- analysis can include or exclude them.
-- purchase_facts is the monthly grain (company x client x sku x month) refreshed after each sync.

-- ── Stock movements ──────────────────────────────────────────────────────────
create table if not exists public.stock_moves (
  id            bigint generated always as identity primary key,
  company       text not null,
  move_date     date not null,
  move_kind     text not null check (move_kind in ('import', 'local_purchase', 'return_in')),
  item_sku      text not null,
  qty           numeric not null,
  doc_num       text,
  client_id     text,          -- returns: who returned it
  return_reason text,          -- returns: reason code (unsold vs damaged / wrong item)
  source_file   text not null,
  loaded_at     timestamptz not null default now()
);

create index if not exists stock_moves_company_sku_date
  on public.stock_moves (company, item_sku, move_date);

alter table public.stock_moves enable row level security;

drop policy if exists stock_moves_read on public.stock_moves;
create policy stock_moves_read on public.stock_moves
  for select to authenticated
  using (public.is_admin_or_above() or company in (
    select unnest(allowed_companies) from public.user_profiles where id = auth.uid()));

-- ── Intergroup clients (selling company's side) ──────────────────────────────
create table if not exists public.intergroup_clients (
  company    text not null,   -- the selling company
  client_id  text not null,   -- the buying group company's client number there
  note       text,
  created_at timestamptz not null default now(),
  primary key (company, client_id)
);

alter table public.intergroup_clients enable row level security;

drop policy if exists intergroup_clients_read on public.intergroup_clients;
create policy intergroup_clients_read on public.intergroup_clients
  for select to authenticated
  using (public.is_admin_or_above() or company in (
    select unnest(allowed_companies) from public.user_profiles where id = auth.uid()));

-- ── Monthly purchase facts ───────────────────────────────────────────────────
create table if not exists public.purchase_facts (
  company          text not null,
  client_id        text not null,
  item_sku         text not null,
  year             smallint not null,
  month            smallint not null,
  qty_sold         numeric not null default 0,   -- invoice + delivery-note lines
  cash_sold        numeric not null default 0,
  docs_sold        integer not null default 0,
  qty_returned     numeric not null default 0,   -- positive: units that came back
  cash_returned    numeric not null default 0,   -- positive
  docs_returned    integer not null default 0,
  qty_ordered      numeric not null default 0,   -- placed orders, kept apart from sales
  first_date       date,
  last_date        date,
  intergroup       boolean not null default false,
  refreshed_at     timestamptz not null default now(),
  primary key (company, client_id, item_sku, year, month)
);

create index if not exists purchase_facts_company_period
  on public.purchase_facts (company, year, month);

alter table public.purchase_facts enable row level security;

drop policy if exists purchase_facts_read on public.purchase_facts;
create policy purchase_facts_read on public.purchase_facts
  for select to authenticated
  using (public.is_admin_or_above() or company in (
    select unnest(allowed_companies) from public.user_profiles where id = auth.uid()));

-- A sales line counts as a return when its source is the returns report or its cash is negative.
create or replace function public.purchase_line_is_return(p_line_source text, p_cash numeric)
returns boolean
language sql
immutable
as $function$
  select p_line_source = '855' or coalesce(p_cash, 0) < 0;
$function$;

-- Rebuild one company's facts. Invoice lines (891) split into sold and returned; orders (722) stay in
-- their own column. Idempotent: the company's rows are replaced in full.
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
        when purchase_line_is_return(line_source, cash) then 'returned'
        else 'sold'
      end as kind
    from sales_lines
    where company = p_company
      and client_id is not null
      and item_sku is not null
      and (line_source in ('855', '722-order') or line_source like 'rep891%')
  ) s
  group by s.client_id, s.item_sku, s.year, s.month;

  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function public.refresh_purchase_facts(text) from public, anon, authenticated;
