-- Seed beginning-phase permission classes (shadow mode — Phase 3 not live yet).
-- CCO class intentionally omitted — Roy will create it and assign dudi.

INSERT INTO app_class (id, label, description, sort_order, active) VALUES
  ('admin', 'Admin',
   'Company admins (roypupik, avishai). Full companies; all pages/widgets; cost+profit fields.',
   10, true),
  ('sales_manager', 'Sales Manager',
   'Field sales manager (kfir). Pupik+Grow; Oversight + sales pages; agent scope all at class level.',
   20, true),
  ('agent', 'Sales Agent',
   'Field agent (24/25/27). Pupik; core pages; agent scope set per-user to ERP id.',
   30, true)
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  active = EXCLUDED.active;

-- Class grants are managed live via /admin/classes; this migration only ensures the three class rows exist.
