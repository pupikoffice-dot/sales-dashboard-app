-- Data health: 887mt.xls (weekly manual sales file, Monkeytime) was loaded by the sync since 2026-11-02 but had no freshness rule,
-- so the coverage guard kept it amber ("loaded by the sync but has no freshness rule"). Same rule as 887pupik.xls / 887gold.xls.
insert into public.source_files (file_name, company, file_group, producer, fix_hint, impact, rule_kind, max_age_hours, active, rows_check)
values ('887mt.xls', 'mt', 'manual_sales', 'manual (main PC)', 'Main PC Task app: run "BDS organizational Examine all"', 'sales lines (887)', 'age', 168, true, true)
on conflict (file_name) do nothing;
