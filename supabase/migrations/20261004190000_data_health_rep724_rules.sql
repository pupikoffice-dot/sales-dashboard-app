-- ERP report 724 = yearly copy of 722 orders (files 724<company>.xls), run weekly on Saturday to
-- backfill older months; 722 becomes the hourly previous + current month file. Both load into the
-- '722-order' data month by month (sync release v009, scoped_load.py).
-- The 724 rules start inactive: switch on (active = true) after the first Saturday run.
insert into public.source_files (file_name, company, file_group, producer, fix_hint, impact, rule_kind, max_age_hours, rows_check, active) values
('724pupik.xls','pupik','weekly_724','smartpupik weekly yearly 722 copy (ERP report 724)','smartpupik Task app: run the weekly 724 task','orders, months before the previous month','age',192,false,false),
('724mt.xls','mt','weekly_724','smartpupik weekly yearly 722 copy (ERP report 724)','smartpupik Task app: run the weekly 724 task','orders, months before the previous month','age',192,false,false),
('724gold.xls','gold','weekly_724','smartpupik weekly yearly 722 copy (ERP report 724)','smartpupik Task app: run the weekly 724 task','orders, months before the previous month','age',192,false,false)
on conflict (file_name) do nothing;
-- 722 is now the previous + current month file, and gold is part of the Rep722 run (it was 'known_broken').
update public.source_files set impact = 'orders, previous + current month (hourly)'
 where file_name in ('722pupik.xls','722mt.xls','722gold.xls');
update public.source_files set file_group = 'rep722', max_age_hours = 3, rows_check = false,
       producer = 'smartpupik Rep722 (ERP report 722)', fix_hint = 'smartpupik Task app: run Run Rep722 all'
 where file_name = '722gold.xls';
