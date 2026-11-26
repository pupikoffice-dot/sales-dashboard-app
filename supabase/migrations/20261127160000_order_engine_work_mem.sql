-- Order recommendation speed: the engine sorts about 110-125k sales lines (last sale, item name lookups) and the
-- database default sort memory is only 3.5 MB, so every sort spilled to disk. Giving the engine 24 MB of sort memory
-- (this function only) cut Monkeytime from about 22.7 s to 8.7 s in a profile; 64 MB gave no further gain.
-- Results are unchanged (memory setting only).
alter function public.order_engine(text, date, boolean) set work_mem to '24MB';
