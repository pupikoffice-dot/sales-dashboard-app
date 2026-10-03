-- Phase 2.5: treat CCO like admin for admin-or-above / manager-or-above gates.
-- Requires 20260819221000_phase25_add_cco_role.sql already applied & committed.

CREATE OR REPLACE FUNCTION is_admin_or_above()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'cco')
  )
$$;

CREATE OR REPLACE FUNCTION is_manager_or_above()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin', 'cco', 'manager')
  )
$$;
