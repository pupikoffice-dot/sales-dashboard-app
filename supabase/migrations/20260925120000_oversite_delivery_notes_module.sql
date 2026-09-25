-- Add deliveryNotes to super-admin default oversite_modules (720 add-on inside Sales MTD).

create or replace function public.get_dashboard_access(p_user_id uuid DEFAULT auth.uid())
 RETURNS dashboard_user_access
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  row dashboard_user_access;
  target uuid := p_user_id;
begin
  if p_user_id is distinct from auth.uid() and not is_super_admin() then
    return null;
  end if;

  if p_user_id = auth.uid() then
    select a.active_as_user_id into target
    from dashboard_user_link_active a
    join dashboard_user_link l
      on l.user_id = a.user_id and l.linked_user_id = a.active_as_user_id
    where a.user_id = auth.uid();
    if target is null then
      target := p_user_id;
    end if;
  end if;

  select * into row from dashboard_user_access where user_id = target;
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
      'ordersToday','ordersMtd','openOrders','salesMtd','deliveryNotes','topItems',
      'suppliers','returns','debt','receipts','stockAlerts'
    ];
    return row;
  end if;
  return null;
end;
$function$;
