-- Security advisor fixes (2026-11-28).
-- 1) client_stats (per-client sales, debt, last order) and unmapped_supplier_prefixes were readable by anyone holding the
--    public anon key, because the views ran with the owner's rights and had public SELECT grants.
--    The only consumer of client_stats is the chat edge function, which uses the service role.
-- 2) _snapshot_permission_config() dumped the whole permission setup to anyone. It is only called from inside
--    activate_version()/release_version() (SECURITY DEFINER), which do not need the caller to hold EXECUTE.
-- 3) Trigger / event-trigger functions do not need to be callable through the API.

alter view public.client_stats set (security_invoker = true);
alter view public.unmapped_supplier_prefixes set (security_invoker = true);
revoke all on public.client_stats from public, anon, authenticated;
revoke all on public.unmapped_supplier_prefixes from public, anon, authenticated;
grant select on public.client_stats to service_role;
grant select on public.unmapped_supplier_prefixes to service_role;

revoke execute on function public._snapshot_permission_config() from public, anon, authenticated;

revoke execute on function public.record_inventory_reading() from public, anon, authenticated;
revoke execute on function public.clients_assign_from_erp_agent() from public, anon, authenticated;
revoke execute on function public.enforce_allowed_companies_edit() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
