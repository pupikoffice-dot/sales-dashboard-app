-- Seed app update settings into app_settings.
-- Admin fills in app_apk_url and bumps app_latest_version whenever a new APK is ready.
-- The mobile app checks these on startup and shows an update banner if needed.

insert into app_settings (key, value, updated_at)
values
  ('app_latest_version', '1.1.0', now()),
  ('app_apk_url',        '',      now())
on conflict (key) do nothing;
