-- Data health: the weekly ERP debt aging exports (report 007) get freshness rules.
-- Debtpupik.xls / Debtmt.xls are written by the aging robot once a week (Friday). The sync now loads Open Debt
-- from them when they are newer than Debt clients.xlsm, so a missed Friday must be seen: red after 8 days.
-- (Debtgrow.xls has no export job; it stays unruled on purpose - grow debt comes from the workbook.)
insert into public.source_files (file_name, company, file_group, producer, fix_hint, impact, rule_kind, max_age_hours, active, rows_check)
values
  ('Debtpupik.xls', 'pupik', 'debt', 'weekly ERP debt aging report 007 (smartpupik Task app: NextERP debt aging)',
   'Check logs\*_aging_report.log on smartpupik and status\erp_results (task Aging-pupik); run "NextERP debt aging - run now"',
   'Open Debt, client debt in the ledger', 'age', 192, true, false),
  ('Debtmt.xls', 'mt', 'debt', 'weekly ERP debt aging report 007 (smartpupik Task app: NextERP debt aging)',
   'Check logs\*_aging_report.log on smartpupik and status\erp_results (task Aging-monkeytime); run "NextERP debt aging - run now"',
   'Open Debt, client debt in the ledger', 'age', 192, true, false)
on conflict (file_name) do update set
  company = excluded.company, file_group = excluded.file_group, producer = excluded.producer,
  fix_hint = excluded.fix_hint, impact = excluded.impact, rule_kind = excluded.rule_kind,
  max_age_hours = excluded.max_age_hours, active = excluded.active;
