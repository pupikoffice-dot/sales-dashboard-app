-- Optional plaintext copy of last set password for admin visibility (set on create / password change via Edge Function).
alter table user_profiles add column if not exists password_display text;
