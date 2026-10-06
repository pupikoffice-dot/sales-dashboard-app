-- Daily item exports for the Items index (smartpupik task "Daily items 103 + 907", 06:00):
-- REP103.BAT (pupik, mt, grow, gold) and REP907.BAT (pupik, mt).
-- The daily rules start inactive: switch on (active = true) after the first daily run.
insert into public.source_files (file_name, company, file_group, producer, fix_hint, impact, rule_kind, max_age_hours, rows_check, active) values
('REP103pupik.xls','pupik','items_daily','smartpupik daily item master (ERP report 103)','smartpupik Task app: run Daily items 103 + 907','Items index (which items are listed), item categories','age',30,true,false),
('REP103MT.xls','mt','items_daily','smartpupik daily item master (ERP report 103)','smartpupik Task app: run Daily items 103 + 907','Items index (which items are listed), item categories','age',30,true,false)
on conflict (file_name) do nothing;
update public.source_files
   set file_group = 'items_daily', max_age_hours = 30, active = false,
       producer = 'smartpupik daily price list (ERP report 907)',
       fix_hint = 'smartpupik Task app: run Daily items 103 + 907',
       impact = 'Items index prices, cost, FOB, barcodes'
 where file_name in ('REP907pupik.xls','REP907mt.xls');
-- item103mt.xls is an older duplicate of REP103MT.xls (same report); its rule is retired.
update public.source_files set active = false where file_name = 'item103mt.xls';
