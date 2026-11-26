-- Daily stock history reaches back about 13 months instead of starting on 1 January 2026.
-- The in-stock-days sales rate (item_sellable_rate) looks at the last 365 days, so the rebuilt history must cover them.
-- Purchases (B8 / 76) for 2020-2025 are now loaded from the yearly rep896 files, so the backward rebuild has what it needs.
-- Only the nightly job changes: it passes a rolling start date (today - 400 days). rebuild_stock_daily itself is unchanged.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'rebuild-stock-daily';
    perform cron.schedule('rebuild-stock-daily', '40 1 * * *',
      $job$select public.rebuild_stock_daily('pupik', current_date - 400); select public.rebuild_stock_daily('mt', current_date - 400);$job$);
  end if;
end;
$$;
