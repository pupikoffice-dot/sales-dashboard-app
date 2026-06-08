-- Per-user dashboard language: en (default) or he (Hebrew + RTL)
alter table dashboard_user_access
  add column if not exists locale text not null default 'en';

alter table dashboard_user_access
  drop constraint if exists dashboard_user_access_locale_check;

alter table dashboard_user_access
  add constraint dashboard_user_access_locale_check
  check (locale in ('en', 'he'));

comment on column dashboard_user_access.locale is
  'UI language for this user: en or he (Hebrew, RTL layout).';
