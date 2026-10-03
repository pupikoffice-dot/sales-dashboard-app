-- Current-month receipt totals by client for Sales Manager Full report.
-- Gated like get_dashboard_aux receipts (super-admin or suite class grant).
create or replace function public.get_receipts_mtd_by_client(
  p_company text,
  p_agents text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access;
  can_see_receipts boolean;
  v_agents text[];
  v_rows jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null then
    return '[]'::jsonb;
  end if;

  if p_company is null or btrim(p_company) = '' then
    return '[]'::jsonb;
  end if;

  if not (p_company = any(acc.companies)) then
    return '[]'::jsonb;
  end if;

  can_see_receipts := is_super_admin() or exists (
    select 1
    from public.app_user_class uc
    join public.app_grant g
      on g.class_id = uc.class_id
     and g.user_id is null
    where uc.user_id = auth.uid()
      and g.kind = 'node'
      and g.effect = 'allow'
      and g.key like 'ui.oversight.suite.%'
  );

  if not can_see_receipts then
    return '[]'::jsonb;
  end if;

  -- Effective agents: intersection of request + access agents (null access = all).
  if p_agents is not null and array_length(p_agents, 1) is not null then
    if acc.agents is not null and array_length(acc.agents, 1) is not null then
      select array_agg(a) into v_agents
      from unnest(p_agents) a
      where a = any(acc.agents);
      if v_agents is null then
        return '[]'::jsonb;
      end if;
    else
      v_agents := p_agents;
    end if;
  elsif acc.agents is not null and array_length(acc.agents, 1) is not null then
    v_agents := acc.agents;
  else
    v_agents := null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'clientID', s.client_id,
        'clientName', s.client_name,
        'cash_gross', s.cash_gross
      )
      order by s.cash_gross desc, s.client_name
    ),
    '[]'::jsonb
  )
    into v_rows
  from (
    select
      erp_client_id as client_id,
      coalesce(max(client_name), '') as client_name,
      sum(cash_gross)::numeric as cash_gross
    from receipt_lines
    where company = p_company
      and collected_date >= date_trunc('month', (now() at time zone 'Asia/Jerusalem'))::date
      and collected_date < (date_trunc('month', (now() at time zone 'Asia/Jerusalem')) + interval '1 month')::date
      and (v_agents is null or agent_erp_id = any(v_agents))
    group by erp_client_id
  ) s;

  return v_rows;
end;
$function$;

grant execute on function public.get_receipts_mtd_by_client(text, text[]) to authenticated;
