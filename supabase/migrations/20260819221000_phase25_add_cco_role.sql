-- Phase 2.5 (revised target tree). Enum value must be its own committed migration
-- before any SQL references 'cco' (Postgres rule).
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cco' AFTER 'admin';
