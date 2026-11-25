-- R&D Expenses: revenue now comes from the same table as R&D -> Yearly data (purchase_facts: invoiced sales minus returns).
-- The first version summed sales_lines, which also holds open ORDER lines (line_source '722-order') next to the invoices,
-- so revenue was about double. Clients flagged intergroup in purchase_facts are left out. Hidden companies stay hidden.
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
