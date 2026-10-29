-- BETA check for remove_chain_stores(): run in the SQL editor. It always rolls back (the final RAISE carries the result).
-- Expect: removed = pupik_before, second = 0, mt_after = mt_before, chain_row = 1, anon_denied = true;
-- a non-super-admin gets null and nothing changes.
do $t$
declare sa uuid; ns uuid; r1 int; r2 int; denied int; pu_before int; mt_before int; pu_after int; mt_after int; anon_denied boolean := false;
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
  set local role anon;
  begin perform public.remove_chain_stores('tsomet', 'pupik'); exception when insufficient_privilege then anon_denied := true; end;
  if not anon_denied then raise exception 'FAIL anon allowed'; end if;
  reset role;
  perform set_config('request.jwt.claim.sub', sa::text, true);
  set local role authenticated;
  r1 := public.remove_chain_stores('tsomet', 'pupik');
  r2 := public.remove_chain_stores('tsomet', 'pupik');
  reset role;
  select count(*) into pu_after from client_chains where chain_id = 'tsomet' and company = 'pupik';
  select count(*) into mt_after from client_chains where chain_id = 'tsomet' and company = 'mt';
  raise exception 'RESULT removed=% second=% pupik_before=% pupik_after=% mt_before=% mt_after=% chain_row=% anon_denied=%',
    r1, r2, pu_before, pu_after, mt_before, mt_after, (select count(*) from chains where id = 'tsomet'), anon_denied;
end $t$;
