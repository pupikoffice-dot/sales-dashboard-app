-- R&D Expenses: Goldbug is hidden for now. Mid-2026 Goldbug moved to an outside accounting firm, so the acc801 file no longer
-- carries its full books. The data stays in the tables; to show Goldbug again, remove 'gold' from the list below.
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
                         from expense_lines where company <> all(hidden) group by company, year, card) t)
  );
end;
$function$;
