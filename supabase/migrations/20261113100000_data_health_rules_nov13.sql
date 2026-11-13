-- Data-health rule corrections from the 2026-11-13 review (already applied by hand to production and BETA;
-- this file makes the repo and a fresh database match them). Idempotent.

-- 722gold: the file only exists in the middle of the day; evaluate it only inside that window.
update public.source_files set eval_from = '11:00', eval_to = '19:00'
 where file_name = '722gold.xls' and eval_from is null;

-- 720 open-delivery lists shrink by design: no proportional row-drop check (freshness and 0-rows alarm stay).
update public.source_files set rows_check = false
 where file_name in ('720mt.xls', '720pupik.xls', '720gold.xls');

-- item103grow: no file is written any more.
update public.source_files set active = false
 where file_name = 'item103grow.xls';

-- Manual sales reports (854, 855, 887, 888) are refreshed by hand once or twice a month: 35 days.
update public.source_files set max_age_hours = 840
 where file_group = 'manual_sales';
