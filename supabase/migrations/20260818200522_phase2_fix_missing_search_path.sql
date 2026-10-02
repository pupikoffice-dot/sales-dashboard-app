-- has_field and scope_agents were missed when search_path was pinned on the
-- other Phase 2 functions -- caught by Supabase's own security advisor.
-- Neither references a table, so this is a hardening change with zero
-- behavior change.
create or replace function public.has_field(p_acc jsonb, p_field text)
returns boolean
language sql
immutable
set search_path to 'public'
as $function$
  select coalesce(p_acc -> 'fields' ? p_field, false)
$function$;

create or replace function public.scope_agents(p_acc jsonb)
returns text[]
language sql
immutable
set search_path to 'public'
as $function$
  select array(select jsonb_array_elements_text(coalesce(p_acc->'agents','[]'::jsonb)))
$function$;
