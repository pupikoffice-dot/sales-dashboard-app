-- Add password_display for super-admin user management UI
-- Run once in Supabase SQL Editor (Sales Dashboard project)

alter table user_profiles
  add column if not exists password_display text;

comment on column user_profiles.password_display is
  'Plain-text password copy for super-admin reference (set via dashboard-user-management Edge Function).';
