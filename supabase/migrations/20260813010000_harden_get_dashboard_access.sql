-- Security fix (pre-existing leak, found while building the "view as user"
-- preview): get_dashboard_access is SECURITY DEFINER with EXECUTE granted to
-- anon + authenticated, and its real-row branch had NO caller check — so any
-- authenticated user could read ANY other user's access config (companies,
-- agents, permission flags) just by passing their uuid.
--
-- Now a caller may only read their own row unless they are a super admin.
-- The app only ever calls this with the caller's own id (the preview path
-- reads the target's row through the RLS-protected table select instead), so
-- this is behaviour-preserving for the dashboard.
create or replace function public.get_dashboard_access(p_user_id uuid DEFAULT auth.uid())
 returns dashboard_user_access
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare row dashboard_user_access;
begin
  -- Only your own row, unless you are a super admin.
  if p_user_id is distinct from auth.uid() and not is_super_admin() then
    return null;
  end if;

  select * into row from dashboard_user_access where user_id = p_user_id;
  if found then return row; end if;

  if is_super_admin() and p_user_id = auth.uid() then
    row.user_id := p_user_id;
    row.modules := array(select id from dashboard_modules order by sort_order);
    row.companies := array['pupik','mt','grow','gold'];
    row.agents := null;
    row.default_module := 'oversite';
    row.active := true;
    row.show_item_cost := true;
    row.show_client_profit := true;
    row.oversite_modules := array[
      'ordersToday','ordersMtd','openOrders','salesMtd','topItems',
      'suppliers','returns','debt','receipts'
    ];
    return row;
  end if;
  return null;
end;
$function$;
