-- Bug fix, found by the Phase 2 equivalence check itself: resolve_access's
-- `agents` CTE routed every agent-scope grant value through a join against
-- user_profiles.agent_erp_id. That lookup is only correct for 'subtree'
-- expansion (subtree user uuids -> their agent_erp_id). A specific ERP agent
-- id grant (e.g. '24') IS ALREADY the value the sales RPCs compare against
-- directly (s.agent_erp_id = any(acc.agents)) -- it should pass straight
-- through, not be looked up as if it were a user's own attribute. Since no
-- user_profiles row has agent_erp_id populated yet (Phase 2.5, not done),
-- the old join silently zeroed out every specific-agent grant.
--
-- Caught by re-running the equivalence check against real impersonated
-- sessions after the first draft: 3 of 7 live users have an explicit agent
-- allow-list, and all 3 came back empty before this fix.
create or replace function public.resolve_access(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
security definer
stable
set search_path to 'public'
as $function$
declare
  v_target uuid := coalesce(p_user_id, auth.uid());
  v_res jsonb;
begin
  if v_target is distinct from auth.uid() and not is_super_admin() then
    return null;
  end if;
  if not exists (select 1 from user_profiles where id = v_target and active) then
    return null;
  end if;

  with eff as (
    select g.kind, g.key, g.value, g.effect
      from app_grant g
      join app_user_class uc on uc.class_id = g.class_id and uc.user_id = v_target
     union all
    select g.kind, g.key, g.value, g.effect
      from app_grant g where g.user_id = v_target
  ),
  net as (
    select kind, key, value from eff e
     where effect = 'allow'
       and not exists (
         select 1 from eff d
          where d.effect = 'deny' and d.kind = e.kind and d.key = e.key
            and (d.value is not distinct from e.value or d.value is null)
       )
  ),
  agents as (
    -- Specific ERP agent ids pass straight through -- this IS the value
    -- sales_lines.agent_erp_id / user_profiles.agent_erp_id compares against.
    select n.value as v
      from net n
     where n.kind = 'scope' and n.key = 'agent' and n.value is not null and n.value <> 'subtree'
     union
    -- 'subtree' expands via the org hierarchy: subtree member uuids -> their
    -- own agent_erp_id. This is the only case that needs user_profiles at all.
    select up.agent_erp_id as v
      from net n
      join user_profiles up on up.id in (select get_subtree_agent_ids(v_target))
     where n.kind = 'scope' and n.key = 'agent' and n.value = 'subtree'
       and up.agent_erp_id is not null
  )
  select jsonb_build_object(
    'user_id',   v_target,
    'active',    true,
    'role',      (select role from user_profiles where id = v_target),
    'companies', (select coalesce(jsonb_agg(distinct value), '[]'::jsonb)
                    from net where kind = 'scope' and key = 'company' and value is not null),
    'companies_all', exists (select 1 from net where kind='scope' and key='company' and value is null),
    'agents',    (select coalesce(jsonb_agg(distinct v), '[]'::jsonb) from agents),
    'agents_all', exists (select 1 from net where kind='scope' and key='agent' and value is null),
    'fields',    (select coalesce(jsonb_agg(distinct key), '[]'::jsonb) from net where kind = 'field'),
    'nodes',     (select coalesce(jsonb_agg(distinct key), '[]'::jsonb) from net where kind = 'node')
  ) into v_res;

  return v_res;
end;
$function$;
