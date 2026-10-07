-- The daily REP103 export writes item103<company>.xls (not REP103<company>.xls). Point the rules at the real
-- file names and switch them on: the daily task "Daily items 103 + 907" has run and the files are fresh.
-- REP907.BAT runs pupik and mt only, so REP907grow / REP907gold stay manual references.
insert into public.source_files (file_name, company, file_group, producer, fix_hint, impact, rule_kind, max_age_hours, rows_check, active) values
('item103pupik.xls','pupik','items_daily','smartpupik daily item master (ERP report 103)','smartpupik Task app: run Daily items 103 + 907','Items index (which items are listed), item categories','age',30,true,true)
on conflict (file_name) do update set file_group = excluded.file_group, producer = excluded.producer,
  fix_hint = excluded.fix_hint, impact = excluded.impact, max_age_hours = excluded.max_age_hours,
  rows_check = excluded.rows_check, active = excluded.active;

update public.source_files
   set file_group = 'items_daily', max_age_hours = 30, active = true,
       producer = 'smartpupik daily item master (ERP report 103)',
       fix_hint = 'smartpupik Task app: run Daily items 103 + 907',
       impact = 'Items index (which items are listed), item categories'
 where file_name in ('item103mt.xls', 'item103grow.xls');

update public.source_files set active = true
 where file_name in ('REP907pupik.xls', 'REP907mt.xls');

-- Old name, never written by the daily task.
update public.source_files set active = false where file_name in ('REP103pupik.xls', 'REP103MT.xls');
