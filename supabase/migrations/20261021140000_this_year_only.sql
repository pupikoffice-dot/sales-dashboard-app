-- "This year only": an admin ticks one box (Admin -> Users -> Years of data) and the user sees the current
-- calendar year (Israel time) only. Built on top of hidden_years: get_dashboard_access() returns every other year
-- as hidden, so every function that already filters by acc.hidden_years (sales, orders, receipts, deliveries,
-- receipts month-to-date) applies it with no further change, and the new year starts by itself on 1 January.
-- The stored hidden_years list is left untouched, so unticking the box restores the earlier choice.
-- Patched in place (text replace on pg_get_functiondef); fails loudly if the text is not found; safe to run twice.

alter table public.dashboard_user_access
  add column if not exists this_year_only boolean not null default false;

do $$
declare
  def text;
  newdef text;
  patch text := E'if found then\n'
    || E'    if row.this_year_only then\n'
    || E'      row.hidden_years := array(\n'
    || E'        select y from generate_series(2000, 2100) y\n'
    || E'        where y <> extract(year from (now() at time zone ''Asia/Jerusalem''))::int\n'
    || E'      );\n'
    || E'    end if;\n'
    || E'    return row;\n'
    || E'  end if;';
begin
  def := pg_get_functiondef('public.get_dashboard_access(uuid)'::regprocedure);
  if def not like '%this_year_only%' then
    newdef := replace(def, 'if found then return row; end if;', patch);
    if newdef = def then raise exception 'this_year_only: row return not found in get_dashboard_access'; end if;
    execute newdef;
  end if;
end;
$$;
