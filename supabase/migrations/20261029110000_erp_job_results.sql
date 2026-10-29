-- ERP export results (Phase 3 of the data health work, sync v035).
-- run_erp_sequential.ps1 notes, for every FinPro call, which files in the data folder actually changed. The sync uploads
-- those rows here, so a stale file can be traced to "the export ran but wrote nothing", "FinPro got stuck" or "never ran".
-- Record-only at first: nothing alerts on this table yet. Read = admins and super admins; writes = service_role (the sync).
create table if not exists public.erp_job_results (
  id             text primary key,                 -- pc | task | start epoch | call index: the same result is never stored twice
  pc             text        not null,
  task           text        not null,             -- job name given to run_erp_sequential.ps1 (P1-step1, Rep722, ...)
  call_index     integer     not null,             -- which FinPro call of the BAT (1..calls)
  calls          integer     not null,
  attempts       integer     not null default 1,   -- 2 = the call was stuck once and retried
  started_at     timestamptz not null,
  finished_at    timestamptz not null,
  exit_code      integer,
  stuck          boolean     not null default false,   -- FinPro did not return in time (at least once)
  export_timeout boolean     not null default false,   -- the export was still running after the wait limit
  files_changed  text[]      not null default '{}',    -- data files whose time or size changed during this call
  snapshot_ok    boolean     not null default true,    -- false = the data folder could not be read, so files_changed is unknown
  created_at     timestamptz not null default now()
);
alter table public.erp_job_results add column if not exists snapshot_ok boolean not null default true;
create index if not exists erp_job_results_task_started_idx on public.erp_job_results (task, started_at desc);
create index if not exists erp_job_results_started_idx on public.erp_job_results (started_at desc);

alter table public.erp_job_results enable row level security;
drop policy if exists erp_job_results_read on public.erp_job_results;
create policy erp_job_results_read on public.erp_job_results for select to authenticated using (public.can_see_data_health());
revoke all on public.erp_job_results from anon, authenticated;
grant select on public.erp_job_results to authenticated;
