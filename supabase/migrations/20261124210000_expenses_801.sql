-- R&D > Expenses: yearly expense details per company (ERP report 801: acc801<company>[<year>].xls).
-- Companies here: pupik, mt, gold, baloo. Baloo exists only for expenses (it is not a dashboard "logical company").
-- Everything is reached through super-admin-only functions; the tables have no policies, so no other login can read them.
-- Amounts are cash ILS; positive = expense, negative = credit to that card (lowers the expense).

create table if not exists public.expense_categories (
  code       text primary key,
  label      text not null,
  sort_order int  not null
);

create table if not exists public.expense_cards (
  company      text not null,
  card         text not null,
  name         text not null default '',
  category     text not null default 'unclassified' references public.expense_categories(code),
  class_source text not null default 'auto' check (class_source in ('auto', 'owner')),
  updated_at   timestamptz not null default now(),
  primary key (company, card)
);

create table if not exists public.expense_lines (
  company text     not null,
  year    int      not null,
  card    text     not null,
  month   smallint not null check (month between 1 and 12),
  amount  numeric(14, 2) not null,
  primary key (company, year, card, month)
);

create table if not exists public.expense_loads (
  company    text not null,
  year       int  not null,
  loaded_at  timestamptz not null default now(),
  file_mtime timestamptz,
  cards      int  not null default 0,
  primary key (company, year)
);

alter table public.expense_categories enable row level security;
alter table public.expense_cards      enable row level security;
alter table public.expense_lines      enable row level security;
alter table public.expense_loads      enable row level security;
revoke all on public.expense_categories, public.expense_cards, public.expense_lines, public.expense_loads from public, anon, authenticated;

insert into public.expense_categories (code, label, sort_order) values
  ('payroll',      'Payroll & employee costs',       10),
  ('premises',     'Rent & premises',                20),
  ('logistics',    'Logistics, shipping & import',   30),
  ('vehicles',     'Vehicles',                       40),
  ('marketing',    'Marketing & exhibitions',        50),
  ('professional', 'Professional services',          60),
  ('it_comms',     'IT & communications',            70),
  ('finance',      'Bank & finance',                 80),
  ('insurance',    'Insurance',                      90),
  ('operations',   'Store operations & packaging',  100),
  ('office_other', 'Office, hospitality & other',   110),
  ('intercompany', 'Intercompany charges',          120),
  ('unclassified', 'Unclassified',                  999)
on conflict (code) do update set label = excluded.label, sort_order = excluded.sort_order;

-- Loader (sync, service role only): replaces one company-year atomically. New cards get the loader's first-guess category;
-- a card the owner classified keeps the owner's category.
create or replace function public.load_expense_file(p_company text, p_year int, p_lines jsonb, p_cards jsonb, p_file_mtime timestamptz)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if p_company not in ('pupik', 'mt', 'gold', 'baloo') then raise exception 'unknown expenses company %', p_company; end if;

  insert into expense_cards (company, card, name, category, class_source, updated_at)
  select p_company, c.card, coalesce(c.name, ''), coalesce(k.code, 'unclassified'), 'auto', now()
  from jsonb_to_recordset(p_cards) as c(card text, name text, category text)
  left join expense_categories k on k.code = c.category
  on conflict (company, card) do update
    set name = excluded.name,
        category = case when expense_cards.class_source = 'owner' then expense_cards.category else excluded.category end,
        updated_at = now();

  delete from expense_lines where company = p_company and year = p_year;
  insert into expense_lines (company, year, card, month, amount)
  select p_company, p_year, l.card, l.month, l.amount
  from jsonb_to_recordset(p_lines) as l(card text, month smallint, amount numeric);

  insert into expense_loads (company, year, loaded_at, file_mtime, cards)
  values (p_company, p_year, now(), p_file_mtime, jsonb_array_length(p_cards))
  on conflict (company, year) do update set loaded_at = now(), file_mtime = excluded.file_mtime, cards = excluded.cards;
end;
$function$;
revoke all on function public.load_expense_file(text, int, jsonb, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.load_expense_file(text, int, jsonb, jsonb, timestamptz) to service_role;

-- Everything the Expenses pages need, in one call (a few thousand small rows at most). null = not a super admin.
create or replace function public.get_expense_data()
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
begin
  if not is_super_admin() then return null; end if;
  return jsonb_build_object(
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'label', label) order by sort_order), '[]'::jsonb) from expense_categories),
    'loads',      (select coalesce(jsonb_agg(jsonb_build_object('co', company, 'y', year, 'at', loaded_at) order by company, year), '[]'::jsonb) from expense_loads),
    'cards',      (select coalesce(jsonb_agg(jsonb_build_object('co', company, 'card', card, 'name', name, 'cat', category, 'src', class_source) order by company, card), '[]'::jsonb) from expense_cards),
    'lines',      (select coalesce(jsonb_agg(x order by x->>'co', (x->>'y')::int, x->>'card'), '[]'::jsonb)
                   from (select jsonb_build_object('co', company, 'y', year, 'card', card,
                                                   'm', jsonb_object_agg(month::text, amount)) as x
                         from expense_lines group by company, year, card) t)
  );
end;
$function$;
revoke all on function public.get_expense_data() from public, anon;
grant execute on function public.get_expense_data() to authenticated;

-- Owner classifies a card (per company + card number).
create or replace function public.set_expense_card_category(p_company text, p_card text, p_category text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_super_admin() then raise exception 'not allowed'; end if;
  if not exists (select 1 from expense_categories where code = p_category) then raise exception 'unknown category %', p_category; end if;
  update expense_cards set category = p_category, class_source = 'owner', updated_at = now()
   where company = p_company and card = p_card;
  if not found then raise exception 'unknown card % / %', p_company, p_card; end if;
end;
$function$;
revoke all on function public.set_expense_card_category(text, text, text) from public, anon;
grant execute on function public.set_expense_card_category(text, text, text) to authenticated;
