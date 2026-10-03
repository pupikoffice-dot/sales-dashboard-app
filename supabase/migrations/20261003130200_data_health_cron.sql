-- Run data-health-check every 30 minutes. The function decides itself (local time, Saturday)
-- whether to evaluate, so this schedule is correct across daylight-saving changes.
-- Per project, before applying: store the function URL and the project's public anon key in vault:
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/data-health-check', 'data_health_function_url');
--   select vault.create_secret('<anon JWT>', 'data_health_anon_key');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'data-health-check';
select cron.schedule('data-health-check', '*/30 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'data_health_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'data_health_anon_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$job$);
