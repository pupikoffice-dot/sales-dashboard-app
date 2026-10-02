-- ═══════════════════════════════════════════════════════════════════════════
-- First super_admin profile (run once per new Supabase project / staging)
-- ═══════════════════════════════════════════════════════════════════════════
-- BEFORE THIS SCRIPT:
--   1. Supabase Dashboard → Authentication → Users → Add user
--      (email + password). Confirm the user appears in the list.
--   2. Open that user → copy the User UID.
--   3. Replace PASTE_AUTH_USER_UUID below with ONLY the UUID (36 characters,
--      with dashes). Example: 273eee8b-7062-47eb-9859-e6413725d49f
--      Do NOT paste the letters "UID" or any label — that causes error 22P02.
--   4. Replace email and display name below.
--   5. SQL Editor → New query → paste → Run (on the correct project).
--
-- AFTER: sign in to Sales Console (admin-app) with that email/password.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.user_profiles (id, email, name, role, parent_id, active)
values (
  'PASTE_AUTH_USER_UUID'::uuid,  -- UUID only, e.g. 273eee8b-7062-47eb-9859-e6413725d49f (never prefix with "UID ")
  'you@yourcompany.com',
  'Super Admin',
  'super_admin'::public.user_role,
  null,
  true
)
on conflict (id) do update set
  email   = excluded.email,
  name    = excluded.name,
  role    = excluded.role,
  active  = excluded.active,
  parent_id = coalesce(public.user_profiles.parent_id, excluded.parent_id);
