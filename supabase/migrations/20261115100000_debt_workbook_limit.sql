-- Debt clients.xlsm is a hand-saved workbook; pupik and monkeytime debt now loads straight from the Friday
-- ERP exports (Debtpupik.xls / Debtmt.xls keep their own 8-day rule), so the workbook is mainly the grow source.
-- Limit relaxed from 7 days to 35 days (already applied by hand to production on 2026-11-15). Idempotent.
update public.source_files set max_age_hours = 840
 where file_name = 'Debt clients.xlsm';
