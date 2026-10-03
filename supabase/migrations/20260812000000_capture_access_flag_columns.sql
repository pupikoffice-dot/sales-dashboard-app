-- DRIFT CAPTURE (no-op against production; these objects already exist live).
--
-- show_item_cost / show_client_profit / locale were added out-of-band via
-- sales-dashboard-app/supabase/add_cost_profit_permissions.sql and add_user_locale.sql
-- and were never tracked here. The 20260813* migrations REFERENCE these columns
-- (row.show_item_cost := true), so a clean replay of this directory failed at that
-- point. This migration is deliberately dated BEFORE 20260813000000 to restore a
-- replayable order that matches the real history.
alter table dashboard_user_access
  add column if not exists show_item_cost     boolean not null default false,
  add column if not exists show_client_profit boolean not null default false,
  add column if not exists locale             text    not null default 'en';

alter table dashboard_user_access
  drop constraint if exists dashboard_user_access_locale_check;
alter table dashboard_user_access
  add constraint dashboard_user_access_locale_check check (locale in ('en','he'));

comment on column dashboard_user_access.show_item_cost is
  'When true, user may see item purchase cost in Stock view (Cost, Total Cost, cost pie).';
comment on column dashboard_user_access.show_client_profit is
  'When true, user may see catalog Price and future profit/margin columns on client/item reports.';
comment on column dashboard_user_access.locale is
  'UI language for this user: en or he (Hebrew, RTL layout).';
