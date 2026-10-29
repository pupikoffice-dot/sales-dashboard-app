-- BETA check for remove_chain_stores() and chain_removal_log: run in the SQL editor. Always rolls back (the final RAISE carries the result).
-- Expect: removed = pupik_before, second = 0, mt_after = mt_before, chain_row = 1, anon_denied = true,
-- log_rows = 1 with company pupik, count = removed, user = the super admin; non-super-admin gets null, cannot read the log, cannot write it.
do $t$
declare sa uuid; ns uuid; r1 int; r2 int; denied int; pu_before int; mt_before int; pu_after int; mt_after int;
  anon_denied boolean := false; ns_log_rows int; ns_write_denied boolean := false; anon_log_denied boolean := false;
  lg record; log_rows int;
begin
  select id into sa from user_profiles where role = 'super_admin' limit 1;
  select id into ns from user_profiles where role is distinct from 'super_admin' limit 1;
  select count(*) into pu_before from client_chains where chain_id = 'tsomet' and company = 'pupik';
  select count(*) into mt_before from client_chains where chain_id = 'tsomet' and company = 'mt';
  perform set_config('request.jwt.claim.sub', coalesce(ns::text, '00000000-0000-0000-0000-000000000000'), true);
  set local role authenticated;
  denied := public.remove_chain_stores('tsomet', 'pupik');
  if denied is not null then raise exception 'FAIL non-super-admin got %', denied; end if;
  if (select count(*) from client_chains where chain_id = 'tsomet' and company = 'pupik') <> pu_before then raise exception 'FAIL rows changed for non-admin'; end if;
  begin insert into chain_removal_log (chain_id, company, removed_count) values ('x', 'pupik', 1); exception when insufficient_privilege then ns_write_denied := true; end;
  if not ns_write_denied then raise exception 'FAIL non-admin wrote the log'; end if;
  set local role anon;
  begin perform public.remove_chain_stores('tsomet', 'pupik'); exception when insufficient_privilege then anon_denied := true; end;
  if not anon_denied then raise exception 'FAIL anon allowed'; end if;
  begin perform 1 from chain_removal_log limit 1; exception when insufficient_privilege then anon_log_denied := true; end;
  if not anon_log_denied then raise exception 'FAIL anon can read the log'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub', sa::text, true);
  set local role authenticated;
  r1 := public.remove_chain_stores('tsomet', 'pupik');
  r2 := public.remove_chain_stores('tsomet', 'pupik');
  select * into lg from chain_removal_log order by removed_at desc limit 1;
  select count(*) into log_rows from chain_removal_log where chain_id = 'tsomet' and company = 'pupik' and removed_at > now() - interval '1 minute';
  reset role;
  -- a normal user sees no log rows (RLS)
  perform set_config('request.jwt.claim.sub', coalesce(ns::text, '00000000-0000-0000-0000-000000000000'), true);
  set local role authenticated;
  select count(*) into ns_log_rows from chain_removal_log;
  reset role;
  select count(*) into pu_after from client_chains where chain_id = 'tsomet' and company = 'pupik';
  select count(*) into mt_after from client_chains where chain_id = 'tsomet' and company = 'mt';
  raise exception 'RESULT removed=% second=% pupik_before=% pupik_after=% mt_before=% mt_after=% chain_row=% anon_denied=% log_rows=% log_company=% log_count=% log_user_ok=% log_email=% ns_sees_log_rows=% ns_write_denied=% anon_log_denied=%',
    r1, r2, pu_before, pu_after, mt_before, mt_after, (select count(*) from chains where id = 'tsomet'), anon_denied,
    log_rows, lg.company, lg.removed_count, (lg.removed_by = sa), lg.removed_by_email is not null, ns_log_rows, ns_write_denied, anon_log_denied;
end $t$;
