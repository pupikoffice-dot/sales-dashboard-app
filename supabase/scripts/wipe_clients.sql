-- Maintenance: remove every row from public.clients (staging / clean slate).
-- Safe regarding FKs: no other table references clients.id; sales_lines use erp_client_id text.
-- After running: re-run Python sync with acc101 files so RLS joins and agent views recover quickly.
-- Prefer service role / SQL Editor as postgres (bypasses RLS on delete if any).

delete from public.clients;

-- Alternative (same effect for this table):
-- truncate table public.clients;
