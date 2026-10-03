-- Per-rule switch for the rows-dropped check. The current-year 891 files are loaded month by
-- month from release v003 (daily file = previous + current month, weekly yearly run = full year),
-- so their row count changes by design and must not raise a "rows dropped" alert.
alter table public.source_files add column if not exists rows_check boolean not null default true;
update public.source_files set rows_check = false
 where file_name in ('rep891pupik.xls', 'rep891mt.xls', 'rep891gold.xls');
-- Their existing rows:<file> status rows would otherwise stay on the page forever.
delete from public.source_file_status where check_key in ('rows:rep891pupik.xls', 'rows:rep891mt.xls', 'rows:rep891gold.xls');
