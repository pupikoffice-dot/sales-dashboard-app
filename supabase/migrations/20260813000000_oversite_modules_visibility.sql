-- Per-user visibility of individual Oversight sections ("modules" within the
-- Oversight page, distinct from the page-level `modules` column). NULL/unset
-- means opt-in-nothing going forward (per product decision), EXCEPT this
-- migration backfills every EXISTING row to all-9-visible once, so no
-- current user's dashboard goes blank the moment this ships. Any user row
-- created after this point with no explicit value is opt-in (empty).
alter table public.dashboard_user_access
  add column if not exists oversite_modules text[];

update public.dashboard_user_access
set oversite_modules = array[
  'ordersToday','ordersMtd','openOrders','salesMtd','topItems',
  'suppliers','returns','debt','receipts'
]
where oversite_modules is null;

-- Super-admin fallback branch (no row yet) also gets full oversight
-- visibility by default, consistent with its other full-access defaults.
create or replace function public.get_dashboard_access(p_user_id uuid DEFAULT auth.uid())
 returns dashboard_user_access
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare row dashboard_user_access;
begin
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
