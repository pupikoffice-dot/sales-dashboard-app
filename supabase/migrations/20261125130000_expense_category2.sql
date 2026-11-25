-- R&D Expenses: a second, owner-built classification of the cards ("Category 2").
-- It is independent of the first category (which the loader fills in by card name): the owner makes the list, assigns each card
-- (or leaves it unassigned), and the pages add a table that sums by Category 2 only. The loader never touches category2, so a
-- card keeps its Category 2 across reloads. Everything is super admin only, like the rest of Expenses.

create table if not exists public.expense_categories2 (
  code       text primary key,
  label      text not null,
  sort_order int  not null
);
alter table public.expense_categories2 enable row level security;
revoke all on public.expense_categories2 from public, anon, authenticated;

alter table public.expense_cards
  add column if not exists category2 text references public.expense_categories2(code) on delete restrict;

create or replace function public.save_expense_category2(p_code text, p_label text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_label text := btrim(coalesce(p_label, ''));
  v_code  text := nullif(btrim(coalesce(p_code, '')), '');
begin
  if not is_super_admin() then raise exception 'not allowed'; end if;
  if v_label = '' then raise exception 'category name is empty'; end if;
  if exists (select 1 from expense_categories2 where lower(label) = lower(v_label) and code is distinct from v_code) then
    raise exception 'a Category 2 named "%" already exists', v_label;
  end if;
  if v_code is null then
    v_code := 'c2_' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    insert into expense_categories2 (code, label, sort_order)
    values (v_code, v_label, coalesce((select max(sort_order) from expense_categories2), 0) + 1);
  else
    update expense_categories2 set label = v_label where code = v_code;
    if not found then raise exception 'unknown Category 2 %', v_code; end if;
  end if;
  return v_code;
end;
$function$;

create or replace function public.move_expense_category2(p_code text, p_dir int)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_order int;
  v_other text;
  v_other_order int;
begin
  if not is_super_admin() then raise exception 'not allowed'; end if;
  select sort_order into v_order from expense_categories2 where code = p_code;
  if not found then raise exception 'unknown Category 2 %', p_code; end if;
  if p_dir < 0 then
    select code, sort_order into v_other, v_other_order from expense_categories2 where sort_order < v_order order by sort_order desc limit 1;
  else
    select code, sort_order into v_other, v_other_order from expense_categories2 where sort_order > v_order order by sort_order limit 1;
  end if;
  if v_other is null then return; end if;
  update expense_categories2 set sort_order = v_other_order where code = p_code;
  update expense_categories2 set sort_order = v_order where code = v_other;
end;
$function$;

create or replace function public.delete_expense_category2(p_code text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_super_admin() then raise exception 'not allowed'; end if;
  if exists (select 1 from expense_cards where category2 = p_code) then
    raise exception 'cards still use this Category 2 - move them to another one (or to "not assigned") first';
  end if;
  delete from expense_categories2 where code = p_code;
end;
$function$;

-- Assign a card to a Category 2; p_category2 null = not assigned. Does not touch the first category or its "set by".
create or replace function public.set_expense_card_category2(p_company text, p_card text, p_category2 text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_super_admin() then raise exception 'not allowed'; end if;
  if p_category2 is not null and not exists (select 1 from expense_categories2 where code = p_category2) then
    raise exception 'unknown Category 2 %', p_category2;
  end if;
  update expense_cards set category2 = p_category2 where company = p_company and card = p_card;
  if not found then raise exception 'unknown card % / %', p_company, p_card; end if;
end;
$function$;

revoke all on function public.save_expense_category2(text, text) from public, anon;
revoke all on function public.move_expense_category2(text, int) from public, anon;
revoke all on function public.delete_expense_category2(text) from public, anon;
revoke all on function public.set_expense_card_category2(text, text, text) from public, anon;
grant execute on function public.save_expense_category2(text, text) to authenticated;
grant execute on function public.move_expense_category2(text, int) to authenticated;
grant execute on function public.delete_expense_category2(text) to authenticated;
grant execute on function public.set_expense_card_category2(text, text, text) to authenticated;

-- The page data: adds the Category 2 list and each card's Category 2 (null = not assigned).
create or replace function public.get_expense_data()
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
declare
  hidden text[] := array['gold'];   -- companies not shown
begin
  if not is_super_admin() then return null; end if;
  return jsonb_build_object(
    'categories',  (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'label', label) order by sort_order), '[]'::jsonb) from expense_categories),
    'categories2', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'label', label) order by sort_order), '[]'::jsonb) from expense_categories2),
    'loads',       (select coalesce(jsonb_agg(jsonb_build_object('co', company, 'y', year, 'at', loaded_at) order by company, year), '[]'::jsonb) from expense_loads where company <> all(hidden)),
    'cards',       (select coalesce(jsonb_agg(jsonb_build_object('co', company, 'card', card, 'name', name, 'cat', category, 'cat2', category2, 'src', class_source) order by company, card), '[]'::jsonb) from expense_cards where company <> all(hidden)),
    'lines',       (select coalesce(jsonb_agg(x order by x->>'co', (x->>'y')::int, x->>'card'), '[]'::jsonb)
                    from (select jsonb_build_object('co', company, 'y', year, 'card', card,
                                                    'm', jsonb_object_agg(month::text, amount)) as x
                          from expense_lines where company <> all(hidden) group by company, year, card) t),
    'revenue',     (select coalesce(jsonb_agg(x order by x->>'co', (x->>'y')::int), '[]'::jsonb)
                    from (select jsonb_build_object('co', company, 'y', year, 'm', jsonb_object_agg(month::text, rev)) as x
                          from (select f.company, f.year::int as year, f.month::int as month, round(sum(f.cash_sold - f.cash_returned), 2) as rev
                                from purchase_facts f
                                where f.company in (select distinct company from expense_loads where company <> all(hidden))
                                  and f.year in (select distinct year from expense_loads)
                                  and not f.intergroup
                                group by f.company, f.year, f.month) r
                          group by company, year) t)
  );
end;
$function$;
