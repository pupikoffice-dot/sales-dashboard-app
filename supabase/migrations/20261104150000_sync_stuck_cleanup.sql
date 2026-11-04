-- BETA ONLY (do not apply to production without owner approval).
-- Marks orphan sync_logs rows still 'running' after 6 h as 'failed' (the sync process died without closing its row).
-- Idempotent; returns the number of rows changed. Called by the data-health-check edge function every run (service role).
create or replace function public.sync_stuck_cleanup()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  update public.sync_logs
     set status = 'failed',
         finished_at = coalesce(finished_at, now()),
         error_message = coalesce(error_message, 'orphan: still running after 6 h, marked failed by sync_stuck_cleanup')
   where status = 'running'
     and started_at < now() - interval '6 hours';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.sync_stuck_cleanup() from public, anon, authenticated;
grant execute on function public.sync_stuck_cleanup() to service_role;
