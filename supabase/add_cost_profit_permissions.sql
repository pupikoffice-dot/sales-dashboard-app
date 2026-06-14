-- Per-user visibility for item purchase cost (rep907) and client catalog price / profit
alter table dashboard_user_access
  add column if not exists show_item_cost boolean not null default false,
  add column if not exists show_client_profit boolean not null default false;

comment on column dashboard_user_access.show_item_cost is
  'When true, user may see item purchase cost in Stock view (Cost, Total Cost, cost pie).';

comment on column dashboard_user_access.show_client_profit is
  'When true, user may see catalog Price and future profit/margin columns on client/item reports.';

-- get_dashboard_access returns the full row type; new columns are included automatically.
-- Super-admin synthetic row in the function does not set these — app treats super_admin as always allowed.
