-- Data-health rules for the R&D Expenses files (acc801<co>.xls, written by REPacc801dash.BAT, smartpupik 23:45 Sunday to Thursday)
-- and the Goldbug stock file (stock902gold.xls, written by REP902.BAT every 2 hours from 07:30).
-- Age rules count working hours only (Friday and Saturday do not count), so a Thursday-night file is not late on Sunday morning.
-- acc801: no row-drop check (the file without a year restarts small in January). Goldbug acc801 is switched off: Goldbug left the
-- ERP books mid-2026 (outside accounting firm), the BAT no longer writes it.
insert into public.source_files (file_name, company, file_group, producer, fix_hint, impact, rule_kind, max_age_hours, eval_from, eval_to, rows_check, active) values
('acc801pupik.xls', 'pupik', 'expenses', 'smartpupik task REPacc801dash (ERP report 801), 23:45 Sunday to Thursday', 'smartpupik Task app: run REPacc801dash expenses; check the task last result', 'R&D Expenses (current year)', 'age', 30, null, null, false, true),
('acc801mt.xls',    'mt',    'expenses', 'smartpupik task REPacc801dash (ERP report 801), 23:45 Sunday to Thursday', 'smartpupik Task app: run REPacc801dash expenses; check the task last result', 'R&D Expenses (current year)', 'age', 30, null, null, false, true),
('acc801baloo.xls', 'baloo', 'expenses', 'smartpupik task REPacc801dash (ERP report 801), 23:45 Sunday to Thursday', 'smartpupik Task app: run REPacc801dash expenses; check the task last result', 'R&D Expenses (current year)', 'age', 30, null, null, false, true),
('acc801gold.xls',  'gold',  'expenses', 'retired: Goldbug expenses are not in the ERP report any more', '-', 'R&D Expenses (Goldbug hidden)', 'age', 30, null, null, false, false),
('stock902gold.xls', 'gold', 'stock_gold', 'smartpupik task REP902 Goldbug stock (ERP report 902), every 2 hours from 07:30', 'smartpupik Task app: run REP902 Goldbug stock; check the task last result', 'Goldbug stock on the Items page', 'age', 6, '10:00', '21:00', true, true)
on conflict (file_name) do nothing;
