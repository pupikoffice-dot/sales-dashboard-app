-- The 721 open-order exports legitimately shrink and grow (Monkeytime fell from about 60 lines to 2 as orders shipped), so the
-- "loaded far fewer rows than usual" check raises false alarms for them. Switch it off; freshness and the 0-rows alarm stay.
update public.source_files
   set rows_check = false
 where file_name in ('721mt.xls', '721pupik.xls', '721gold.xls');
