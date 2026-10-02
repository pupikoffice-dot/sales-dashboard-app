-- Stock Alerts was rendering ungated in Oversight, so it was missing from the
-- per-user module list. Add it as the 10th toggleable section.
--
-- Existing users can currently SEE stock alerts, so grant it to every row that
-- already has a configured module list — otherwise gating the panel would
-- silently remove a section they have today. Rows with NULL stay NULL (opt-in),
-- consistent with the original migration. Appending (rather than resetting)
-- preserves any sections an admin has already unchecked.
update public.dashboard_user_access
set oversite_modules = oversite_modules || array['stockAlerts']
where oversite_modules is not null
  and not ('stockAlerts' = any(oversite_modules));

-- Keep the super-admin fallback (used when no row exists yet) in step.
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
      'suppliers','returns','debt','receipts','stockAlerts'
    ];
    return row;
  end if;
  return null;
end;
$function$;
