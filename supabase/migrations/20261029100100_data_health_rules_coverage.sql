-- Data health: rules for every file the sync loads that had none (coverage guard, 2026-10-29).
-- Found 2026-10-29: rep895/896/897 and the closed-year 855 / 891 files were loaded but not monitored.
insert into public.source_files (file_name, company, file_group, producer, fix_hint, impact, rule_kind, max_age_hours, eval_from, eval_to, rows_check) values
-- 895 (purchases) runs with P1, every 90 min 08:00-20:00; red after 4 h, checked 10:00-21:00
('rep895pupik.xls','pupik','p1','smartpupik P1 (ERP report 895)','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','purchases / arrivals','age',4,'10:00','21:00',false),
('rep895mt.xls','mt','p1','smartpupik P1 (ERP report 895)','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','purchases / arrivals','age',4,'10:00','21:00',false),
('rep895gold.xls','gold','p1','smartpupik P1 (ERP report 895)','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','purchases / arrivals','age',4,'10:00','21:00',false),
-- 896 (stock moves / imports) weekly, Friday 22:30; red after 8 days
('rep896pupik.xls','pupik','weekly_896','smartpupik weekly task (ERP report 896)','smartpupik Task app: run the weekly 896 task','stock moves, imports','age',192,null,null,false),
('rep896mt.xls','mt','weekly_896','smartpupik weekly task (ERP report 896)','smartpupik Task app: run the weekly 896 task','stock moves, imports','age',192,null,null,false),
('rep896gold.xls','gold','weekly_896','smartpupik weekly task (ERP report 896)','smartpupik Task app: run the weekly 896 task','stock moves, imports','age',192,null,null,false),
-- 897 (855 from January) weekly; red after 8 days
('rep897pupik.xls','pupik','weekly_897','smartpupik weekly task (ERP report 897)','smartpupik Task app: run the weekly 897 task','credit notes / returns from January','age',192,null,null,false),
('rep897mt.xls','mt','weekly_897','smartpupik weekly task (ERP report 897)','smartpupik Task app: run the weekly 897 task','credit notes / returns from January','age',192,null,null,false)
on conflict (file_name) do nothing;

-- Closed years: loaded once, never expected to change.
insert into public.source_files (file_name, company, file_group, producer, fix_hint, impact, rule_kind)
select f, c, 'frozen', 'manual (closed year)', 'Closed year - only re-export if the ERP history changes', 'sales / credit history', 'frozen'
from (values
  ('rep855pupik2023.xls','pupik'), ('rep855pupik2024.xls','pupik'), ('rep855pupik2025.xls','pupik'),
  ('rep891gold2025.xls','gold'),
  ('rep891mt2020a.xls','mt'), ('rep891mt2021a.xls','mt'), ('rep891mt2021b.xls','mt'), ('rep891mt2022.xls','mt'),
  ('rep891mt2022a.xls','mt'), ('rep891mt2022b.xls','mt'), ('rep891mt2023.xls','mt'), ('rep891mt2023a.xls','mt'),
  ('rep891mt2023b.xls','mt'), ('rep891mt2024.xls','mt'),
  ('rep891pupik2020a.xls','pupik'), ('rep891pupik2020b.xls','pupik'), ('rep891pupik2021a.xls','pupik'),
  ('rep891pupik2021b.xls','pupik'), ('rep891pupik2022.xls','pupik'), ('rep891pupik2022a.xls','pupik'),
  ('rep891pupik2022b.xls','pupik'), ('rep891pupik2023.xls','pupik'), ('rep891pupik2023a.xls','pupik'),
  ('rep891pupik2023b.xls','pupik'), ('rep891pupik2024.xls','pupik')
) as t(f, c)
on conflict (file_name) do nothing;
