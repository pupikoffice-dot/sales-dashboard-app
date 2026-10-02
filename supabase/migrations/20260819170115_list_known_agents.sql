-- Distinct agent codes across all companies, for the class/permission admin
-- tool's agent picker. No per-user "self" scope exists for a flat list like
-- this (unlike resolve_access/get_dashboard_aux, which gate cross-user
-- lookups but always allow reading your own data) -- restricted outright.
create or replace function public.list_known_agents()
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case when is_super_admin()
    then coalesce(array_agg(distinct agent_erp_id order by agent_erp_id), array[]::text[])
    else array[]::text[]
  end
  from sales_lines
  where agent_erp_id is not null and agent_erp_id <> ''
$function$;

grant execute on function public.list_known_agents() to authenticated;
