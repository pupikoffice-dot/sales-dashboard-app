-- ERP report 894 = yearly copy of 891 (files rep894<company>.xls), run weekly to backfill older
-- months; loaded into the rep891 data month by month (sync release v004, scoped_load.py).
-- Rules start inactive: switch on (active = true) once the weekly task exists on smartpupik.
insert into public.source_files (file_name, company, file_group, producer, fix_hint, impact, rule_kind, max_age_hours, rows_check, active) values
('rep894pupik.xls','pupik','weekly_894','smartpupik weekly yearly 891 copy (ERP report 894)','smartpupik Task app: run the weekly 894 task','sales, months before the previous month','age',192,false,false),
('rep894mt.xls','mt','weekly_894','smartpupik weekly yearly 891 copy (ERP report 894)','smartpupik Task app: run the weekly 894 task','sales, months before the previous month','age',192,false,false),
('rep894gold.xls','gold','weekly_894','smartpupik weekly yearly 891 copy (ERP report 894)','smartpupik Task app: run the weekly 894 task','sales, months before the previous month','age',192,false,false)
on conflict (file_name) do nothing;
-- 891 is now the daily previous + current month file.
update public.source_files set impact = 'sales, previous + current month (daily)'
 where file_name in ('rep891pupik.xls','rep891mt.xls','rep891gold.xls');
