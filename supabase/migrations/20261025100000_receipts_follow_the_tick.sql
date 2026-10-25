-- Receipts (collection report 008) are released by the "receipts" tick in Admin -> Users -> Oversight Modules, per user.
-- Before: the database returned receipts only to a super admin or to a class holding an Oversight suite permission
-- (Sales Manager / Sales Agent), so a user outside those classes (e.g. class CCO) had the tick but got no data, while
-- "View as" (which uses the admin's session) showed receipts the real user never received.
-- Now: super admin, or the user's own saved "receipts" tick. Everything else in these functions is unchanged (companies,
-- agents, hidden years). Applies to get_dashboard_aux (receipts by month) and get_receipts_mtd_by_client.
-- Patched in place (text replace on pg_get_functiondef); fails loudly if the text changed; safe to run twice.

do $$
declare
  f record;
  def text;
  newdef text;
  pat text := 'is_super_admin\(\) or exists \(\s*select 1\s*from public\.app_user_class uc\s*join public\.app_grant g\s*on g\.class_id = uc\.class_id\s*and g\.user_id is null\s*where uc\.user_id = auth\.uid\(\)\s*and g\.kind = ''node''\s*and g\.effect = ''allow''\s*and g\.key like ''ui\.oversight\.suite\.%''\s*\)';
begin
  for f in
    select p.oid, p.proname from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname in ('get_dashboard_aux', 'get_receipts_mtd_by_client')
  loop
    def := pg_get_functiondef(f.oid);
    continue when def like '%''receipts'' = any(coalesce(acc.oversite_modules%';
    newdef := regexp_replace(def, pat, 'is_super_admin() or ''receipts'' = any(coalesce(acc.oversite_modules, ''{}''::text[]))');
    if newdef = def then raise exception 'receipts_follow_the_tick: receipts gate not found in %', f.proname; end if;
    execute newdef;
  end loop;
end;
$$;
