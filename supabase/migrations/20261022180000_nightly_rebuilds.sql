-- Nightly rebuilds (04:40 Israel time = 01:40 UTC, after the early sync):
--   * stock_daily: real readings copied in, earlier days rebuilt backward from purchases and sales
--   * purchase_facts: monthly net purchases per client and item
-- Skipped silently where pg_cron is not installed; re-running replaces the job.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'rebuild-stock-daily';
    perform cron.schedule('rebuild-stock-daily', '40 1 * * *',
      $job$select public.rebuild_stock_daily('pupik'); select public.rebuild_stock_daily('mt');$job$);

    perform cron.unschedule(jobid) from cron.job where jobname = 'refresh-purchase-facts';
    perform cron.schedule('refresh-purchase-facts', '50 1 * * *',
      $job$select public.refresh_purchase_facts('pupik'); select public.refresh_purchase_facts('mt'); select public.refresh_purchase_facts('grow'); select public.refresh_purchase_facts('gold');$job$);
  end if;
end;
$$;
