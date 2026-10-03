-- Test switch for the data health checker: when true, it ignores the Saturday / working-hours /
-- rule-window gates. Only set via SQL (service role / dashboard), never by the app. Keep false.
alter table public.data_health_settings add column if not exists ignore_calendar boolean not null default false;
