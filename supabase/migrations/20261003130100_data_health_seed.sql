-- Rules from the spec (section 1). Hours: 7 d = 168, 14 d = 336, 30 d = 720.
insert into public.source_files (file_name, company, file_group, producer, fix_hint, impact, rule_kind, max_age_hours, eval_from, eval_to) values
-- p1: smartpupik P1, every 90 min 08:00-20:00; red after 4 h, checked 10:00-21:00
('720pupik.xls','pupik','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','open deliveries','age',4,'10:00','21:00'),
('720mt.xls','mt','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','open deliveries','age',4,'10:00','21:00'),
('720gold.xls','gold','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','open deliveries','age',4,'10:00','21:00'),
('721pupik.xls','pupik','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','open orders','age',4,'10:00','21:00'),
('721mt.xls','mt','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','open orders','age',4,'10:00','21:00'),
('721gold.xls','gold','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','open orders','age',4,'10:00','21:00'),
('rep891pupik.xls','pupik','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','sales (current year)','age',4,'10:00','21:00'),
('rep891mt.xls','mt','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','sales (current year)','age',4,'10:00','21:00'),
('rep891gold.xls','gold','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','sales (current year)','age',4,'10:00','21:00'),
('collectyear008pupik.xls','pupik','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','receipts','age',4,'10:00','21:00'),
('collectyear008mt.xls','mt','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','receipts','age',4,'10:00','21:00'),
-- rep722: hourly 09:00-18:00; red after 3 h, checked 11:00-19:00
('722pupik.xls','pupik','rep722','smartpupik Rep722','smartpupik Task app: run "Run Rep722 all"','orders today / MTD','age',3,'11:00','19:00'),
('722mt.xls','mt','rep722','smartpupik Rep722','smartpupik Task app: run "Run Rep722 all"','orders today / MTD','age',3,'11:00','19:00'),
-- wms: copy only when source changes; red after 30 h
('000pupik.xls','pupik','wms','smartpupik Copy WMS','smartpupik Task app: run "Copy WMS pupik and MT"; check the source in Sales Lists\DATA','stock','age',30,null,null),
('000mt.xls','mt','wms','smartpupik Copy WMS','smartpupik Task app: run "Copy WMS pupik and MT"; check the source in Sales Lists\DATA','stock','age',30,null,null),
-- nightly_aski: written by ERP user aski ~03:36; must be modified today, checked from 04:30
('rep893pupik.xls','pupik','nightly_aski','ERP user aski nightly batch','Not our job: ask the owner of the aski nightly batch; manual: \\srv\findat\batch\REP893.BAT','operations deliveries','nightly',null,'04:30',null),
('rep893mt.xls','mt','nightly_aski','ERP user aski nightly batch','Not our job: ask the owner of the aski nightly batch; manual: \\srv\findat\batch\REP893.BAT','operations deliveries','nightly',null,'04:30',null),
-- manual_sales: 7 days
('854PUP.xls','pupik','manual_sales','manual','Run \\srv\findat\batch\REP855&854ALL.BAT','sales lines (854)','age',168,null,null),
('854MT.xls','mt','manual_sales','manual','Run \\srv\findat\batch\REP855&854ALL.BAT','sales lines (854)','age',168,null,null),
('854grow.xls','grow','manual_sales','manual','Run \\srv\findat\batch\REP855&854ALL.BAT','sales lines (854)','age',168,null,null),
('855PUP.xls','pupik','manual_sales','manual','Run \\srv\findat\batch\REP855&854ALL.BAT','returns MTD','age',168,null,null),
('855MT.xls','mt','manual_sales','manual','Run \\srv\findat\batch\REP855&854ALL.BAT','returns MTD','age',168,null,null),
('887pupik.xls','pupik','manual_sales','manual (main PC)','Main PC Task app: run "BDS organizational Examine all"','sales lines (887)','age',168,null,null),
('887gold.xls','gold','manual_sales','manual (main PC)','Main PC Task app: run "BDS organizational Examine all"','sales lines (887)','age',168,null,null),
('888pupik.xls','pupik','manual_sales','manual (main PC)','Main PC Task app: run "BDS organizational Examine all"','sales lines (888)','age',168,null,null),
('888mt.xls','mt','manual_sales','manual (main PC)','Main PC Task app: run "BDS organizational Examine all"','sales lines (888)','age',168,null,null),
('888gold.xls','gold','manual_sales','manual (main PC)','Main PC Task app: run "BDS organizational Examine all"','sales lines (888)','age',168,null,null),
-- manual_ref: 14 days
('REP907pupik.xls','pupik','manual_ref','manual','Run the REP907 price report','prices / cost','age',336,null,null),
('REP907mt.xls','mt','manual_ref','manual','Run the REP907 price report','prices / cost','age',336,null,null),
('REP907grow.xls','grow','manual_ref','manual','Run the REP907 price report','prices / cost','age',336,null,null),
('REP907gold.xls','gold','manual_ref','manual','Run the REP907 price report','prices / cost','age',336,null,null),
('item103mt.xls','mt','manual_ref','manual','Run the item103 category report','item categories','age',336,null,null),
('item103grow.xls','grow','manual_ref','manual','Run the item103 category report','item categories','age',336,null,null),
-- manual_clients: 30 days, owner unknown
('acc101pupik.xls','pupik','manual_clients','unknown (to identify)','Owner unknown: find who runs acc101','client list / agents','age',720,null,null),
('acc101mt.xls','mt','manual_clients','unknown (to identify)','Owner unknown: find who runs acc101','client list / agents','age',720,null,null),
('acc101grow.xls','grow','manual_clients','unknown (to identify)','Owner unknown: find who runs acc101','client list / agents','age',720,null,null),
('acc101gold.xls','gold','manual_clients','unknown (to identify)','Owner unknown: find who runs acc101','client list / agents','age',720,null,null),
-- debt + tsomet: 7 days
('Debt clients.xlsm',null,'debt','user workbook + main PC "Copy debt clients file"','Update Debt clients.xlsm on the main PC; Task app "Copy debt clients file" copies it to Data','debt figures','age',168,null,null),
('tsomet/budget.xlsx','mt','frozen','yearly budget (manual)','-','Tsomet cube (MT) budget','frozen',null,null,null),
('tsomet/sales.xlsx','mt','tsomet','main PC segment report','Main PC Task app: run "Segment sales report (tsomet)"','Tsomet cube (MT)','age',168,null,null),
-- known_broken: 2 days, incidents pre-acknowledged below
('721grow.xls','grow','known_broken','none running (grow exports stopped)','Investigate the grow ERP export','grow open orders','age',48,null,null),
('rep891grow.xls','grow','known_broken','none running (grow exports stopped)','Investigate the grow ERP export','grow sales','age',48,null,null),
('collectyear008grow.xls','grow','known_broken','none running (grow exports stopped)','Investigate the grow ERP export','grow receipts','age',48,null,null),
('722gold.xls','gold','known_broken','none running since 2026-08-28','Find which job should export 722gold','gold orders','age',48,null,null),
-- frozen
('rep891pupik2025.xls','pupik','frozen','historical','-','sales 2025','frozen',null,null,null),
('rep891mt2025.xls','mt','frozen','historical','-','sales 2025','frozen',null,null,null),
('rep891grow2025.xls','grow','frozen','historical','-','sales 2025','frozen',null,null,null),
('collectyear008pupik 2024.xls','pupik','frozen','historical','-','receipts 2024','frozen',null,null,null),
('collectyear008mt 2024.xls','mt','frozen','historical','-','receipts 2024','frozen',null,null,null),
('collectyear008grow 2024.xls','grow','frozen','historical','-','receipts 2024','frozen',null,null,null),
('salesagentstargets26.xlsx',null,'frozen','yearly (manual)','-','agent targets','frozen',null,null,null)
on conflict (file_name) do nothing;

insert into public.data_health_settings (id, recipients, from_address)
values (true, array['pupikoffice@gmail.com'], 'onboarding@resend.dev')
on conflict (id) do nothing;

-- Known at go-live: open + acknowledged, so they show red without emails.
insert into public.data_health_incidents (check_key, reason, acknowledged_at, notes)
select f, 'known at go-live (2026-10-03)', now(), 'pre-acknowledged at go-live'
from unnest(array['721grow.xls','rep891grow.xls','collectyear008grow.xls','722gold.xls',
                  'acc101mt.xls','acc101grow.xls','acc101gold.xls']) f
where not exists (select 1 from public.data_health_incidents i where i.check_key = f and i.closed_at is null);
