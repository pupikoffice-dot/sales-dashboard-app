-- R&D Expenses: monthly revenue per company (all sales lines, returns included as negatives, clients marked as intergroup left out)
-- so the pages can show each expense as a % of revenue. Hidden companies stay hidden.
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
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'label', label) order by sort_order), '[]'::jsonb) from expense_categories),
    'loads',      (select coalesce(jsonb_agg(jsonb_build_object('co', company, 'y', year, 'at', loaded_at) order by company, year), '[]'::jsonb) from expense_loads where company <> all(hidden)),
    'cards',      (select coalesce(jsonb_agg(jsonb_build_object('co', company, 'card', card, 'name', name, 'cat', category, 'src', class_source) order by company, card), '[]'::jsonb) from expense_cards where company <> all(hidden)),
    'lines',      (select coalesce(jsonb_agg(x order by x->>'co', (x->>'y')::int, x->>'card'), '[]'::jsonb)
                   from (select jsonb_build_object('co', company, 'y', year, 'card', card,
                                                   'm', jsonb_object_agg(month::text, amount)) as x
                         from expense_lines where company <> all(hidden) group by company, year, card) t),
    'revenue',    (select coalesce(jsonb_agg(x order by x->>'co', (x->>'y')::int), '[]'::jsonb)
                   from (select jsonb_build_object('co', company, 'y', year, 'm', jsonb_object_agg(month::text, rev)) as x
                         from (select s.company, s.year::int as year, s.month::int as month, round(sum(s.cash), 2) as rev
                               from sales_lines s
                               where s.company in (select distinct company from expense_loads where company <> all(hidden))
                                 and s.year in (select distinct year from expense_loads)
                                 and not exists (select 1 from intergroup_clients ig where ig.company = s.company and ig.client_id = s.client_id)
                               group by s.company, s.year, s.month) r
                         group by company, year) t)
  );
end;
$function$;
